import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import { addDraftComponent } from '../../../src/shared/prototype-design-system-draft'
import {
  mobileDesignSystemDraftCount,
  mobileDesignSystemDraftText,
  mobileDesignSystemNothingToSend,
  sendMobileDesignSystemText,
  type MobileDesignSystemSendFlow
} from './mobile-prototype-design-system-send'
import { NEXUS_SYSTEM, nexusContent, nexusSet } from './mobile-prototype-design-system.test-fixture'
import type { RpcClient } from '../transport/rpc-client'

const chat = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('./mobile-prototype-chat-text-send', () => ({ sendMobilePrototypeText: chat.send }))

const host = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('./mobile-prototype-host-chat-send', () => ({ sendToStructuredSessionOnHost: host.send }))

const TARGET = { sessionId: 'session-nexus', agent: 'codex' as const, worktreeId: 'wt-1' }

function flowOver(initial: DesignSystemViewState): {
  flow: MobileDesignSystemSendFlow
  current: () => DesignSystemViewState
} {
  let state = initial
  return {
    flow: {
      client: null,
      target: TARGET,
      getState: () => state,
      update: (transform) => {
        state = transform(state)
      }
    },
    current: () => state
  }
}

function withAddedComponent(): DesignSystemViewState {
  const state = emptyDesignSystemViewState()
  return { ...state, draft: addDraftComponent(state.draft, 'Toast') }
}

beforeEach(() => {
  chat.send.mockReset()
  host.send.mockReset()
})

describe('the draft text', () => {
  const content = nexusContent()

  it('asks for the next version, lists the changes and rebuilds the sets built on this one', () => {
    const text = mobileDesignSystemDraftText({
      system: NEXUS_SYSTEM,
      content,
      state: { ...withAddedComponent(), freeText: 'Calmer tone' },
      rebuildSets: [nexusSet()]
    })
    expect(text).toContain('Update the design system to v3.')
    expect(text).toContain('Design system · components')
    expect(text).toContain('add: Add component: Toast')
    expect(text).toContain('Rebuild Liquidaciones fases 1-3 on v3.')
    expect(text).toContain('Calmer tone')
  })

  it('leaves the rebuild out when the option is off', () => {
    const text = mobileDesignSystemDraftText({
      system: NEXUS_SYSTEM,
      content,
      state: { ...withAddedComponent(), rebuild: false },
      rebuildSets: [nexusSet()]
    })
    expect(text).not.toContain('Rebuild ')
  })

  it('counts the changes, and sends nothing for no change and no text', () => {
    expect(mobileDesignSystemDraftCount({ content, state: withAddedComponent() })).toBe(1)
    const empty = emptyDesignSystemViewState()
    expect(mobileDesignSystemNothingToSend({ content, state: empty })).toBe(true)
    expect(mobileDesignSystemNothingToSend({ content, state: { ...empty, freeText: ' ' } })).toBe(
      true
    )
    expect(mobileDesignSystemNothingToSend({ content, state: { ...empty, freeText: 'Hi' } })).toBe(
      false
    )
  })

  it('counts an attached image as something to send', () => {
    const empty = emptyDesignSystemViewState()
    const withImage = { ...empty, images: [{ id: 'a', name: 'Image 1', path: '/h/a.png' }] }
    expect(mobileDesignSystemNothingToSend({ content, state: withImage })).toBe(false)
  })
})

describe('sending the draft images', () => {
  const ready = { id: 'a', name: 'Image 1', path: '/h/a.png', connectionId: 'conn-1' }

  const client: RpcClient = Object.create(null)

  it('sends the ready images with the draft through the host and clears them once it takes it', async () => {
    host.send.mockResolvedValue(true)
    const { flow, current } = flowOver({
      ...withAddedComponent(),
      images: [ready, { id: 'b', name: 'Image 2' }]
    })
    expect(await sendMobileDesignSystemText({ ...flow, client }, 'draft', 'Update')).toBe(true)
    expect(host.send).toHaveBeenCalledWith(client, TARGET.sessionId, 'Update', [
      { path: '/h/a.png', previewUri: '/h/a.png', connectionId: 'conn-1' }
    ])
    expect(chat.send).not.toHaveBeenCalled()
    expect(current().images).toEqual([])
  })

  it('keeps the images when the host refuses the draft', async () => {
    host.send.mockResolvedValue(false)
    const { flow, current } = flowOver({ ...withAddedComponent(), images: [ready] })
    expect(await sendMobileDesignSystemText({ ...flow, client }, 'draft', 'Update')).toBe(false)
    expect(current().images).toEqual([ready])
  })

  it('carries no draft images on a re-detect', async () => {
    chat.send.mockResolvedValue(true)
    const { flow } = flowOver({ ...emptyDesignSystemViewState(), images: [ready] })
    await sendMobileDesignSystemText(flow, 'redetect', 'Detect again')
    expect(chat.send).toHaveBeenCalledWith(null, TARGET, 'Detect again')
    expect(host.send).not.toHaveBeenCalled()
  })
})

describe('sendMobileDesignSystemText', () => {
  it('clears the draft and the text when the chat takes the message', async () => {
    chat.send.mockResolvedValue(true)
    const { flow, current } = flowOver({ ...withAddedComponent(), freeText: 'Calmer tone' })
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(true)
    expect(chat.send).toHaveBeenCalledWith(null, TARGET, 'Update')
    expect(current().draft.added).toEqual([])
    expect(current().freeText).toBe('')
    expect(current().sending).toBe(false)
    expect(current().failed).toBeNull()
  })

  it('keeps the draft and marks the failure when the chat refuses', async () => {
    chat.send.mockResolvedValue(false)
    const { flow, current } = flowOver({ ...withAddedComponent(), freeText: 'Calmer tone' })
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(false)
    expect(current().draft.added).toEqual(['Toast'])
    expect(current().freeText).toBe('Calmer tone')
    expect(current().failed).toBe('draft')
    expect(current().sending).toBe(false)
  })

  it('reads a send that throws as a refusal', async () => {
    chat.send.mockRejectedValue(new Error('offline'))
    const { flow, current } = flowOver(withAddedComponent())
    expect(await sendMobileDesignSystemText(flow, 'draft', 'Update')).toBe(false)
    expect(current().failed).toBe('draft')
    expect(current().draft.added).toEqual(['Toast'])
  })

  it('sends nothing without a chat or while another send is in flight', async () => {
    const none = flowOver(withAddedComponent())
    expect(
      await sendMobileDesignSystemText({ ...none.flow, target: undefined }, 'draft', 'x')
    ).toBe(false)
    const busy = flowOver({ ...withAddedComponent(), sending: true })
    expect(await sendMobileDesignSystemText(busy.flow, 'draft', 'x')).toBe(false)
    expect(chat.send).not.toHaveBeenCalled()
  })
})
