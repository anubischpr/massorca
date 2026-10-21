import { describe, expect, it } from 'vitest'
import {
  AGENT_JOURNAL_THREAD_SCOPE,
  type AgentJournalRenderItem
} from '../../../../shared/agent-session-journal-types'
import { AGENT_SESSION_COMMAND_RESULT_PRESENTATION } from '../../../../shared/native-chat-command-result'
import {
  nativeChatStatusRowText,
  withNativeChatCommandResultRows
} from './native-chat-command-result-rows'

const row = { id: 7, text: 'Agent: Codex', observedAt: 1_700_000_000_000 }

function statusItem(sequence: number, sequenceIndex?: number): AgentJournalRenderItem {
  return {
    itemId: `status-${sequence}`,
    revision: 0,
    body: { kind: 'status', text: 'Earlier', tone: 'notice' },
    sequence,
    ...(sequenceIndex === undefined ? {} : { sequenceIndex }),
    observedAt: 1
  }
}

describe('command results in the transcript', () => {
  it('returns the journal itself when no command has answered', () => {
    const items = [statusItem(1)]
    expect(withNativeChatCommandResultRows(items, [])).toBe(items)
  })

  it('appends each result after the last row as a command-result status row', () => {
    const items = [statusItem(4, 1)]
    const [, notice] = withNativeChatCommandResultRows(items, [row])
    expect(notice).toMatchObject({
      revision: 0,
      body: {
        kind: 'status',
        text: 'Agent: Codex',
        tone: 'notice',
        presentation: AGENT_SESSION_COMMAND_RESULT_PRESENTATION
      },
      sequence: 4,
      sequenceIndex: 1.5,
      observedAt: row.observedAt
    })
    expect(notice?.turnScope).toBeUndefined()
  })

  it('states the thread for a journal whose rows carry turn scopes', () => {
    const scoped: AgentJournalRenderItem = {
      ...statusItem(2),
      turnScope: AGENT_JOURNAL_THREAD_SCOPE
    }
    const [, notice] = withNativeChatCommandResultRows([scoped], [row])
    expect(notice?.turnScope).toEqual(AGENT_JOURNAL_THREAD_SCOPE)
  })

  it('keeps the rows in the order the commands ran', () => {
    const notices = withNativeChatCommandResultRows([], [row, { ...row, id: 8, text: 'Second' }])
    expect(notices.map((item) => item.sequenceIndex)).toEqual([0.5, 1])
    const ids = notices.map((item) => item.itemId)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id) => id.includes('command-result'))).toBe(true)
  })
})

describe('the status row text', () => {
  it('states one label and value per line', () => {
    expect(
      nativeChatStatusRowText([
        { label: 'Model', value: 'GPT' },
        { label: 'Access', value: 'Read only' }
      ])
    ).toBe('Model: GPT\nAccess: Read only')
  })
})
