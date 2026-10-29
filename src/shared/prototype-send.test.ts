import { describe, expect, it, vi } from 'vitest'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'
import { splitPrototypeHiddenInstruction } from './prototype-hidden-instruction'
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

/** Fake dependencies, with each mock kept for its assertions. */
function makeDeps(
  parts: {
    capture?: PrototypeSendDeps['captureRect']
    write?: PrototypeSendDeps['writeAttachment']
    send?: PrototypeSendDeps['sendMessage']
  } = {}
) {
  const captureRect = vi.fn(
    parts.capture ?? (async () => ({ ok: true as const, pngBase64: 'iVBORw0KGgo=' }))
  )
  const writeAttachment = vi.fn(
    parts.write ?? (async () => ({ ok: true as const, path: 'C:/chat/prototypes/x/notes/pin.png' }))
  )
  const sendMessage = vi.fn(parts.send ?? (async (_text: string) => true))
  const deps: PrototypeSendDeps = {
    captureRect,
    writeAttachment,
    sendMessage,
    now: () => 42
  }
  return { deps, captureRect, writeAttachment, sendMessage }
}

describe('sendPrototypeIteration', () => {
  it('captures the pin, saves it on the host and sends the message with the screenshot path', async () => {
    const fakes = makeDeps()
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      fakes.deps
    )
    expect(fakes.captureRect).toHaveBeenCalledWith({ x: 110, y: 70, width: 120, height: 40 })
    expect(fakes.writeAttachment).toHaveBeenCalledWith(
      `pin-${pinKeyFor('button.cta')}-42`,
      'iVBORw0KGgo='
    )
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).toContain('  screenshot: C:/chat/prototypes/x/notes/pin.png')
    const [text = ''] = fakes.sendMessage.mock.calls[0] ?? []
    expect(splitPrototypeHiddenInstruction(text).visibleText).toBe(outcome.visibleMessage)
    expect(text).toContain('A-v2.html')
  })

  it('sends without the screenshot when the capture fails', async () => {
    const fakes = makeDeps({ capture: async () => ({ ok: false as const }) })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      fakes.deps
    )
    expect(fakes.writeAttachment).not.toHaveBeenCalled()
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
  })

  it('sends without the screenshot when the upload rejects', async () => {
    const fakes = makeDeps({
      write: async () => {
        throw new Error('outdated host')
      }
    })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: FRAME },
      fakes.deps
    )
    expect(outcome.sent).toBe(true)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
  })

  it('takes no screenshot while a peek shows another frame', async () => {
    const fakes = makeDeps()
    const peeking = { ...editedState(), view: 'B' }
    await sendPrototypeIteration({ state: peeking, set: SET, frameOrigin: FRAME }, fakes.deps)
    expect(fakes.captureRect).not.toHaveBeenCalled()
  })

  it('reports a refused send so the draft is kept', async () => {
    const fakes = makeDeps({ send: async () => false })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: null },
      fakes.deps
    )
    expect(outcome.sent).toBe(false)
  })

  it('treats a thrown send as refused', async () => {
    const fakes = makeDeps({
      send: async () => {
        throw new Error('chat gone')
      }
    })
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: SET, frameOrigin: null },
      fakes.deps
    )
    expect(outcome.sent).toBe(false)
  })

  it('sends nothing when the set has no request folder on the host', async () => {
    const fakes = makeDeps()
    const outcome = await sendPrototypeIteration(
      { state: editedState(), set: { ...SET, folderPath: undefined }, frameOrigin: FRAME },
      fakes.deps
    )
    expect(outcome.sent).toBe(false)
    expect(fakes.sendMessage).not.toHaveBeenCalled()
  })
})
