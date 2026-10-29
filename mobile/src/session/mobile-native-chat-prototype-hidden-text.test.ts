// A prototype request's hidden instruction never shows on a mobile surface that draws user text.
import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import {
  buildPrototypeRequestMessage,
  type PrototypeRequestMessage
} from '../../../src/shared/prototype-request'
import { chatTitleFromMessages } from './mobile-chat-summary-model'
import { normalizedUserText } from './mobile-native-chat-draft-reconcile'
import {
  buildMobileNativeChatTransientData,
  foldMobileNativeChatMessages
} from './mobile-native-chat-render-data'

const TYPED = 'Make a mockup of the checkout page'

function requestMessage(text: string): PrototypeRequestMessage {
  return buildPrototypeRequestMessage({
    text,
    agent: 'codex',
    count: 2,
    requestId: 'req-1',
    folderPath: '/chats/c1/prototypes/req-1'
  })
}

function user(id: string, text: string): NativeChatMessage {
  return { id, role: 'user', blocks: [{ type: 'text', text }], timestamp: 0, source: 'transcript' }
}

function textOf(message: NativeChatMessage | undefined): string {
  return (message?.blocks ?? []).map((block) => (block.type === 'text' ? block.text : '')).join('')
}

describe('hidden prototype instruction on mobile', () => {
  const sent = requestMessage(TYPED).sentText

  it('sends something to hide in the first place', () => {
    expect(sent).not.toBe(TYPED)
  })

  it('is stripped from a transcript user turn', () => {
    const folded = foldMobileNativeChatMessages([user('u1', sent)])
    expect(textOf(folded[0])).toBe(TYPED)
  })

  it('keeps the typed echo of a /prototype command, not the command word the agent never sees', () => {
    const command = requestMessage('/prototype a login page').sentText
    const folded = foldMobileNativeChatMessages([user('u1', command)])
    expect(textOf(folded[0])).toBe('/prototype a login page')
  })

  it('leaves other turns as they are', () => {
    const plain = user('u1', 'Fix the build')
    const folded = foldMobileNativeChatMessages([plain])
    expect(folded[0]).toBe(plain)
  })

  it('is stripped from an optimistic bubble', () => {
    const { data } = buildMobileNativeChatTransientData({
      messages: [],
      folded: [],
      streaming: null,
      pending: [{ id: 'pending-1', text: sent }]
    })
    expect(textOf(data[0])).toBe(TYPED)
  })

  it('does not stop a pending echo from matching the transcript turn', () => {
    expect(normalizedUserText(user('u1', sent))).toBe(TYPED)
  })

  it('is never part of a chat title', () => {
    expect(chatTitleFromMessages([user('u1', sent)])).toBe(TYPED)
  })
})
