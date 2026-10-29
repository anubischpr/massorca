import { describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { splitPrototypeHiddenInstruction } from '../../../../shared/prototype-hidden-instruction'
import { PrototypeHostOutdatedError } from '../../runtime/runtime-prototype-client'
import { sendPrototypeIteration, type PrototypeSendDeps } from './prototype-send'
import {
  createSetState,
  editSelected,
  pickElement,
  pinKeyFor,
  type PrototypeSetState
} from './prototype-set-state'

const SET: PrototypeListedSet = {
  requestId: '20261029-100000-000001',
  sessionId: 'session-1',
  agent: 'codex',
  worktreeId: 'wt-1',
  chatTitle: 'checkout-flow',
  originalPrompt: 'checkout',
  createdAt: '2026-10-29T10:00:00.000Z',
  count: 2,
  folderPath: 'C:/chat/prototypes/20261029-100000-000001',
  directions: [
    { letter: 'A', versions: [{ version: 1, fileName: 'A.html', mtime: 1 }] },
    { letter: 'B', versions: [{ version: 1, fileName: 'B.html', mtime: 1 }] }
  ]
}

const PIN_ELEMENT = {
  selector: 'button.cta',
  label: 'pay button',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  htmlSnippet: '<button>Pay</button>',
  state: {
    text: 'Pay',
    color: '#fff',
    bg: '#000',
    width: { value: 100, unit: '%' as const },
    height: { value: 48, unit: 'px' as const },
    fontSize: 14
  }
}

function editedState(): PrototypeSetState {
  const picked = pickElement(createSetState(['A', 'B']), PIN_ELEMENT)
  return editSelected(picked, { color: '#ff0000' })
}

const FRAME = { x: 100, y: 50, width: 640, height: 500 }

function deps(overrides: Partial<PrototypeSendDeps> = {}): PrototypeSendDeps & {
  sendMessage: ReturnType<typeof vi.fn>
  writeAttachment: ReturnType<typeof vi.fn>
} {
  return {
    captureRect: vi.fn(async () => ({ ok: true as const, pngBase64: 'iVBORw0KGgo=' })),
    writeAttachment: vi.fn(async () => ({
      ok: true as const,
      path: 'C:/chat/prototypes/x/notes/pin.png'
    })),
    sendMessage: vi.fn(async () => true),
    now: () => 42,
    ...overrides
  } as PrototypeSendDeps & {
    sendMessage: ReturnType<typeof vi.fn>
    writeAttachment: ReturnType<typeof vi.fn>
  }
}

describe('sendPrototypeIteration', () => {
  it('captures the pin, saves it on the host and sends the message with the screenshot path', async () => {
    const send = deps()
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      send
    )
    expect(send.captureRect).toHaveBeenCalledWith({ x: 110, y: 70, width: 120, height: 40 })
    expect(send.writeAttachment).toHaveBeenCalledWith(
      `pin-${pinKeyFor('button.cta')}-42`,
      'iVBORw0KGgo='
    )
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).toContain('  screenshot: C:/chat/prototypes/x/notes/pin.png')
    const text = send.sendMessage.mock.calls[0]?.[0] as string
    expect(splitPrototypeHiddenInstruction(text).visibleText).toBe(outcome.visibleMessage)
    expect(text).toContain('A-v2.html')
  })

  it('sends without the screenshot when the capture fails', async () => {
    const send = deps({ captureRect: vi.fn(async () => ({ ok: false as const })) })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      send
    )
    expect(send.writeAttachment).not.toHaveBeenCalled()
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
  })

  it('sends without the screenshot when the host is outdated and rejects the upload', async () => {
    const send = deps({
      writeAttachment: vi.fn(async () => {
        throw new PrototypeHostOutdatedError()
      })
    })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      send
    )
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
  })

  it('takes no screenshot while a peek shows another frame', async () => {
    const send = deps()
    const peeking = { ...editedState(), view: 'B' }
    await sendPrototypeIteration({ state: peeking, set: SET, frameOrigin: FRAME }, send)
    expect(send.captureRect).not.toHaveBeenCalled()
  })

  it('reports a refused send so the draft is kept', async () => {
    const send = deps({ sendMessage: vi.fn(async () => false) })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: null },
      send
    )
    expect(outcome.sent).toBe(false)
  })

  it('treats a thrown send as refused', async () => {
    const send = deps({
      sendMessage: vi.fn(async () => {
        throw new Error('chat gone')
      })
    })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: null },
      send
    )
    expect(outcome.sent).toBe(false)
  })

  it('sends nothing when the set has no request folder on the host', async () => {
    const send = deps()
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: { ...SET, folderPath: undefined }, frameOrigin: FRAME },
      send
    )
    expect(outcome.sent).toBe(false)
    expect(send.sendMessage).not.toHaveBeenCalled()
  })
})
