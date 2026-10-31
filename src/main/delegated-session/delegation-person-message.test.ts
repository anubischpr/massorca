import { describe, expect, it } from 'vitest'
import type { AgentJournalItemBody } from '../../shared/agent-session-journal-types'
import type { AgentMessageSource } from '../../shared/agent-session-message-source'
import { lastPersonMessageText } from './delegation-person-message'

const AGENT_SENDER: AgentMessageSource = { kind: 'agent', senders: [], orchestration: null }

function message(
  role: 'user' | 'assistant',
  text: string,
  from?: AgentMessageSource
): { body: AgentJournalItemBody } {
  return {
    body: { kind: 'message', role, blocks: [{ type: 'text', text }], ...(from ? { from } : {}) }
  }
}

describe('lastPersonMessageText', () => {
  it('is the newest message the person typed', () => {
    expect(
      lastPersonMessageText([
        message('user', 'first ask'),
        message('assistant', 'done'),
        message('user', 'second ask'),
        message('assistant', 'working')
      ])
    ).toBe('second ask')
  })

  it('skips a message another agent sent', () => {
    expect(
      lastPersonMessageText([
        message('user', 'the real ask'),
        message('user', 'child report', AGENT_SENDER)
      ])
    ).toBe('the real ask')
  })

  it('is undefined for a chat with no such message', () => {
    expect(lastPersonMessageText([])).toBeUndefined()
    expect(lastPersonMessageText([message('assistant', 'hello')])).toBeUndefined()
  })
})
