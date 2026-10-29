import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from './agent-session-journal-types'
import type { NativeChatBlock } from './native-chat-types'
import { withoutPrototypeHiddenInstruction } from './prototype-hidden-blocks'
import { buildPrototypeRequestMessage } from './prototype-request'
import { projectStructuredAgentSessionMessages } from './structured-agent-session-message-projection'
import { projectStructuredItemToNativeChat } from './structured-agent-session-projection'

const SENT = buildPrototypeRequestMessage({
  text: 'Make a mockup of the pricing page',
  agent: 'codex',
  count: 2,
  requestId: '20261028-201500-k3f9q2',
  folderPath: '/work/prototypes/20261028-201500-k3f9q2'
}).sentText

function text(value: string): NativeChatBlock {
  return { type: 'text', text: value }
}

function userItem(blocks: NativeChatBlock[], itemId = 'message:one'): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence: 1,
    observedAt: 1,
    body: { kind: 'message', role: 'user', blocks }
  }
}

describe('withoutPrototypeHiddenInstruction', () => {
  it('keeps the text before the marker and drops the instruction', () => {
    expect(withoutPrototypeHiddenInstruction([text(SENT)])).toEqual([
      text('Make a mockup of the pricing page')
    ])
  })

  it('returns the same array when there is nothing hidden', () => {
    const image: NativeChatBlock = { type: 'image-ref', path: '/tmp/a.png' }
    const blocks = [text('hello'), image]
    expect(withoutPrototypeHiddenInstruction(blocks)).toBe(blocks)
  })

  it('drops a block that was only the hidden instruction and keeps other blocks', () => {
    const image: NativeChatBlock = { type: 'image-ref', path: '/tmp/a.png' }
    expect(
      withoutPrototypeHiddenInstruction([text(SENT.slice(SENT.indexOf('<!--'))), image])
    ).toEqual([image])
  })
})

describe('the transcript projection', () => {
  it('shows a user message without its hidden instruction', () => {
    const message = projectStructuredItemToNativeChat(userItem([text(SENT)]))
    expect(message?.blocks).toEqual([text('Make a mockup of the pricing page')])
  })

  it('leaves an assistant message alone, whatever it says', () => {
    const blocks = [text(SENT)]
    const message = projectStructuredItemToNativeChat({
      ...userItem(blocks),
      body: { kind: 'message', role: 'assistant', blocks }
    })
    expect(message?.blocks).toBe(blocks)
  })

  it('shows the optimistic bubble of a send still out without its hidden instruction', () => {
    const messages = projectStructuredAgentSessionMessages(
      [],
      [
        {
          clientMessageId: 'client-1',
          queuedAt: 5,
          body: { kind: 'message', role: 'user', blocks: [text(SENT)] }
        }
      ],
      [],
      { rejectedInPlace: false }
    )
    expect(messages.map((message) => message.blocks)).toEqual([
      [text('Make a mockup of the pricing page')]
    ])
  })
})
