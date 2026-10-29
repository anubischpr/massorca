import { describe, expect, it, vi } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import { splitPrototypeHiddenInstruction } from '../../../src/shared/prototype-hidden-instruction'
import {
  createSetState,
  editSelected,
  pickElement,
  setNote,
  setPrompt,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import {
  beginSend,
  draftOf,
  sendRefused,
  sendSucceeded
} from '../../../src/shared/prototype-set-view'
import { registerMobilePrototypeChatSend } from './mobile-prototype-chat-send-registry'
import { sendMobilePrototypeIteration } from './mobile-prototype-iteration-send'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const SET = listedSet({ requestId: 'req-1', sessionId: 'session-1' })
const CTA: NativeChatVisualPickedElement = {
  selector: 'button.cta',
  label: 'pay button',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  state: {
    text: 'Pay now',
    color: '#ffffff',
    bg: '#171717',
    width: { value: 100, unit: '%' },
    height: { value: 48, unit: 'px' },
    fontSize: 14
  }
}
const PROMPT = 'Fold email into the card step.'

function draftedState(): PrototypeSetState {
  let state = pickElement(createSetState(['A', 'B', 'C']), CTA)
  state = editSelected(state, { bg: '#1d4ed8', height: { value: 40, unit: 'px' } })
  state = setNote(state, 'Make it pulse.')
  return setPrompt(state, PROMPT)
}

describe('sendMobilePrototypeIteration', () => {
  it('sends the whole draft to the chat as one message, with the hidden instruction for the next file', async () => {
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-1', send)
    const outcome = await sendMobilePrototypeIteration(draftedState(), SET)
    unregister()

    expect(outcome.sent).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const [text = ''] = send.mock.calls[0] ?? []
    const split = splitPrototypeHiddenInstruction(text)
    expect(split.visibleText).toBe(outcome.visibleMessage)
    expect(split.hidden).toEqual({ kind: 'iteration', requestId: 'req-1', letter: 'A' })
    expect(outcome.visibleMessage).toContain('Iterate on A.')
    expect(outcome.visibleMessage).toContain('fill: #171717 → #1d4ed8')
    expect(outcome.visibleMessage).toContain('note: Make it pulse.')
    expect(outcome.visibleMessage).toContain(PROMPT)
    expect(outcome.visibleMessage).not.toContain('screenshot:')
    expect(text).toContain('A-v2.html')
  })

  it('keeps the draft when the chat is not on screen', async () => {
    const before = draftedState()
    const outcome = await sendMobilePrototypeIteration(before, SET)
    expect(outcome.sent).toBe(false)
    const after = sendRefused(beginSend(before))
    expect(after.sendFailed).toBe(true)
    expect(draftOf(after).itemCount).toBe(draftOf(before).itemCount)
    expect(after.prompt).toBe(PROMPT)
  })

  it('clears the draft and shows what went out once the chat took it', async () => {
    const unregister = registerMobilePrototypeChatSend('session-1', async () => true)
    const before = draftedState()
    const outcome = await sendMobilePrototypeIteration(before, SET)
    unregister()
    const after = sendSucceeded(beginSend(before), outcome.visibleMessage)
    expect(draftOf(after).itemCount).toBe(0)
    expect(after.sentMessage).toBe(outcome.visibleMessage)
    expect(after.sendFailed).toBe(false)
  })

  it('does not send a set that has no folder on the host', async () => {
    const send = vi.fn(async (_text: string) => true)
    const unregister = registerMobilePrototypeChatSend('session-1', send)
    const outcome = await sendMobilePrototypeIteration(draftedState(), {
      ...SET,
      folderPath: undefined
    })
    unregister()
    expect(outcome.sent).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
})
