import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { buildPrototypeRequestMessage } from '../../../../shared/prototype-request'
import { nativeChatTranscriptMarkdown } from './native-chat-transcript-markdown'
import { structuredAgentSessionMessageText } from './structured-agent-session-message-hand-back'

const SENT = buildPrototypeRequestMessage({
  text: 'Make a mockup of the pricing page',
  agent: 'codex',
  count: 2,
  requestId: '20261028-201500-k3f9q2',
  folderPath: '/work/prototypes/20261028-201500-k3f9q2'
}).sentText

describe('the hidden prototype instruction outside the transcript rows', () => {
  it('is not handed back to the composer or a rewind with the text', () => {
    expect(
      structuredAgentSessionMessageText({
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text: SENT }]
      })
    ).toBe('Make a mockup of the pricing page')
  })

  it('is not part of an exported transcript', () => {
    const items: AgentJournalRenderItem[] = [
      {
        itemId: 'message:one',
        revision: 1,
        sequence: 1,
        observedAt: 1,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: SENT }] }
      }
    ]
    expect(nativeChatTranscriptMarkdown(items, { you: 'You', agent: 'Agent' })).toBe(
      '## You\n\nMake a mockup of the pricing page'
    )
  })
})
