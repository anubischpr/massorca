import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { pendingStructuredSessionPrompts } from './structured-agent-session-message-projection'

function question(itemId: string, state: 'pending' | 'resolved'): AgentJournalRenderItem {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial journal item with the fields the projection reads.
  return {
    itemId,
    revision: state === 'pending' ? 1 : 2,
    body: { kind: 'question', resolution: { state } }
  } as unknown as AgentJournalRenderItem
}

// Shape of the real session behind the stuck card: one request answered, one never answered.
describe('pendingStructuredSessionPrompts', () => {
  it('clears an answered question and keeps a second, unanswered request', () => {
    const prompts = pendingStructuredSessionPrompts([
      question('orca:delegation%3Aanswered', 'resolved'),
      question('orca:delegation%3Aprobe', 'pending')
    ])
    expect(prompts.map((prompt) => prompt.itemId)).toEqual(['orca:delegation%3Aprobe'])
  })

  it('leaves no prompt once the only question is answered', () => {
    expect(
      pendingStructuredSessionPrompts([question('orca:delegation%3Aanswered', 'resolved')])
    ).toEqual([])
  })
})
