import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import {
  nativeChatLatestAnswerMarkdown,
  nativeChatTranscriptMarkdown
} from './native-chat-transcript-markdown'

function message(
  role: 'user' | 'assistant' | 'tool',
  text: string,
  sequence: number
): AgentJournalRenderItem {
  return {
    itemId: `${role}-${sequence}`,
    revision: 0,
    body: { kind: 'message', role, blocks: [{ type: 'text', text }] },
    sequence,
    observedAt: sequence
  }
}

const status: AgentJournalRenderItem = {
  itemId: 'status-1',
  revision: 0,
  body: { kind: 'status', text: 'Reconnected', tone: 'notice' },
  sequence: 9,
  observedAt: 9
}

describe('the newest answer', () => {
  it('is the last reply the agent wrote, not a prompt or a tool row', () => {
    const items = [
      message('user', 'First question', 1),
      message('assistant', 'First answer', 2),
      message('user', 'Second question', 3),
      message('assistant', 'Second answer', 4),
      message('tool', 'npm test', 5)
    ]
    expect(nativeChatLatestAnswerMarkdown(items)).toBe('Second answer')
  })

  it('is empty before the agent has replied', () => {
    expect(nativeChatLatestAnswerMarkdown([message('user', 'Hello', 1), status])).toBe('')
  })
})

describe('the transcript export', () => {
  it('writes each prompt and reply under a heading that names its speaker', () => {
    const items = [message('user', 'Fix the tab', 1), status, message('assistant', 'Fixed.', 2)]
    expect(nativeChatTranscriptMarkdown(items, { you: 'You', agent: 'Codex' })).toBe(
      '## You\n\nFix the tab\n\n## Codex\n\nFixed.'
    )
  })

  it('leaves out rows that are neither a prompt nor a reply', () => {
    expect(
      nativeChatTranscriptMarkdown([message('tool', 'ls', 1), status], {
        you: 'You',
        agent: 'Codex'
      })
    ).toBe('')
  })
})
