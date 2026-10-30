import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePrototypeMergePlan } from '../../../src/shared/prototype-merge-plan'
import { beginMerge, planArrived } from '../../../src/shared/prototype-merge-state'
import {
  createSetState,
  toggleStar,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import type { RpcClient } from '../transport/rpc-client'
import {
  readMobilePrototypeMergePlanText,
  sendMobilePrototypeMerge,
  startMobilePrototypeMerge,
  type MobilePrototypeMergeFlow
} from './mobile-prototype-merge-flow'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const sendText = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<boolean>>())
const readFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())

vi.mock('./mobile-prototype-chat-text-send', () => ({ sendMobilePrototypeText: sendText }))
vi.mock('../session/mobile-prototype-host-rpc', () => ({ readMobilePrototypeFile: readFile }))

// The flow only hands the client on; no request goes through it in these tests.
const CLIENT: RpcClient = Object.create(null)
const SET = listedSet({ requestId: 'req-1' })
const PLAN_JSON = JSON.stringify({
  id: 'plan-1',
  from: ['A', 'C'],
  parts: [
    { name: 'Heading', kind: 'section', selectors: { A: 'main > h1', C: 'h1.title' }, from: 'A' },
    { name: 'Pay button', kind: 'component', selectors: { C: 'button.cta' }, from: 'C' }
  ]
})

function starred(...letters: string[]): PrototypeSetState {
  return letters.reduce(toggleStar, createSetState(['A', 'B', 'C']))
}

function reviewing(): PrototypeSetState {
  const plan = parsePrototypeMergePlan(PLAN_JSON)
  if (plan === null) {
    throw new Error('expected a valid plan')
  }
  const waiting = beginMerge(starred('A', 'C'), { planId: 'plan-1', baseline: null })
  return planArrived(waiting, plan, PLAN_JSON)
}

function flowOver(initial: PrototypeSetState, overrides: Partial<MobilePrototypeMergeFlow> = {}) {
  const box = { state: initial }
  const flow: MobilePrototypeMergeFlow = {
    client: CLIENT,
    set: SET,
    nextLetter: 'D',
    getState: () => box.state,
    update: (transform) => {
      box.state = transform(box.state)
    },
    ...overrides
  }
  return { flow, box }
}

beforeEach(() => {
  sendText.mockReset()
  readFile.mockReset()
})

describe('reading the plan file', () => {
  it('reads merge-plan.json in the request folder', async () => {
    readFile.mockResolvedValue({ kind: 'ready', html: PLAN_JSON })
    await expect(readMobilePrototypeMergePlanText(CLIENT, SET)).resolves.toBe(PLAN_JSON)
    expect(readFile).toHaveBeenCalledWith(CLIENT, {
      sessionId: SET.sessionId,
      requestId: 'req-1',
      fileName: 'prototypes/req-1/merge-plan.json'
    })
  })

  it('reads nothing when the file is not there, the host is out of reach, or there is no client', async () => {
    readFile.mockResolvedValue({ kind: 'unreachable' })
    await expect(readMobilePrototypeMergePlanText(CLIENT, SET)).resolves.toBeNull()
    readFile.mockRejectedValue(new Error('lost'))
    await expect(readMobilePrototypeMergePlanText(CLIENT, SET)).resolves.toBeNull()
    await expect(readMobilePrototypeMergePlanText(null, SET)).resolves.toBeNull()
  })
})

describe('asking the chat for a merge plan', () => {
  it('waits for the plan and sends the suggestion request to the chat', async () => {
    readFile.mockResolvedValue({ kind: 'unreachable' })
    sendText.mockResolvedValue(true)
    const { flow, box } = flowOver(starred('A', 'C'))

    await startMobilePrototypeMerge(flow)

    expect(box.state.merge).toMatchObject({ phase: 'waiting', letters: ['A', 'C'] })
    expect(sendText).toHaveBeenCalledTimes(1)
    const [client, set, text] = sendText.mock.calls[0] ?? []
    expect(client).toBe(CLIENT)
    expect(set).toBe(SET)
    expect(String(text)).toMatch(/^Suggest a merge of A and C\.\n\n/u)
  })

  it('ends the merge and keeps the stars when the chat refuses', async () => {
    readFile.mockResolvedValue({ kind: 'unreachable' })
    sendText.mockResolvedValue(false)
    const { flow, box } = flowOver(starred('A', 'C'))

    await startMobilePrototypeMerge(flow)

    expect(box.state.merge).toBeNull()
    expect(box.state.mergeSendFailed).toBe(true)
    expect(box.state.starred).toEqual(['A', 'C'])
  })

  it('ends the merge request and keeps the stars when the send throws', async () => {
    readFile.mockResolvedValue({ kind: 'unreachable' })
    sendText.mockRejectedValue(new Error('lost'))
    const { flow, box } = flowOver(starred('A', 'C'))

    await expect(startMobilePrototypeMerge(flow)).resolves.toBeUndefined()

    expect(box.state.merge).toBeNull()
    expect(box.state.mergeSendFailed).toBe(true)
    expect(box.state.starred).toEqual(['A', 'C'])
  })

  it('sends nothing below two stars, without a free letter, or without a request folder', async () => {
    const one = flowOver(starred('A'))
    await startMobilePrototypeMerge(one.flow)
    const full = flowOver(starred('A', 'C'), { nextLetter: null })
    await startMobilePrototypeMerge(full.flow)
    const noFolder = flowOver(starred('A', 'C'), { set: { ...SET, folderPath: undefined } })
    await startMobilePrototypeMerge(noFolder.flow)

    expect(sendText).not.toHaveBeenCalled()
    expect(one.box.state.merge).toBeNull()
  })
})

describe('sending the merge', () => {
  it('sends the plan with the chosen sources and closes the review once the chat takes it', async () => {
    sendText.mockResolvedValue(true)
    const { flow, box } = flowOver(reviewing())

    await sendMobilePrototypeMerge(flow)

    const [, , text] = sendText.mock.calls[0] ?? []
    // Each part names its selector in every merged direction that has it, not only the chosen one.
    expect(String(text)).toMatch(
      /^Merge into D\.\nHeading \(A: main > h1; C: h1\.title\): from A\n/u
    )
    expect(String(text)).toContain('Pay button (C: button.cta): from C')
    expect(box.state.merge).toBeNull()
    expect(box.state.mergeInto).toEqual({ letter: 'D', from: ['A', 'C'] })
  })

  it('keeps the review, free to send again, with the failure line when the chat refuses', async () => {
    sendText.mockResolvedValue(false)
    const { flow, box } = flowOver(reviewing())

    await sendMobilePrototypeMerge(flow)

    expect(box.state.merge).toMatchObject({ phase: 'review', sending: false })
    expect(box.state.mergeSendFailed).toBe(true)
    expect(box.state.mergeInto).toBeNull()
  })

  it('keeps the review with the failure line when the send throws, free to send again', async () => {
    sendText.mockRejectedValue(new Error('lost'))
    const { flow, box } = flowOver(reviewing())

    await expect(sendMobilePrototypeMerge(flow)).resolves.toBeUndefined()

    expect(box.state.merge).toMatchObject({ phase: 'review', sending: false })
    expect(box.state.mergeSendFailed).toBe(true)
    expect(box.state.mergeInto).toBeNull()
  })

  it('sends nothing when no review is open', async () => {
    const { flow } = flowOver(starred('A', 'C'))
    await sendMobilePrototypeMerge(flow)
    expect(sendText).not.toHaveBeenCalled()
  })
})
