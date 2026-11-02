import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import type { DelegatedChildLinkRow } from '../../orchestration/db/delegation/delegation-request-store'
import { attachDelegatedParents } from './structured-agent-session-status-delegated-parent'

function summary(sessionId: string): AgentSessionStatusSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the code under test reads only sessionId.
  return { sessionId } as unknown as AgentSessionStatusSummary
}

function link(child: string, parent: string): DelegatedChildLinkRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture with the fields the code under test reads.
  return {
    child_session_id: child,
    parent_session_id: parent,
    task_id: 'task-1',
    dispatch_id: 'ctx-1',
    dispatch_status: 'completed'
  } as unknown as DelegatedChildLinkRow
}

describe('attachDelegatedParents', () => {
  it('stamps a finished child with its parent and leaves other sessions alone', () => {
    const [child, parent] = attachDelegatedParents([summary('child'), summary('parent')], () => [
      link('child', 'parent')
    ])
    expect(child?.delegatedParent).toEqual({
      parentSessionId: 'parent',
      taskId: 'task-1',
      dispatchId: 'ctx-1',
      dispatchStatus: 'completed'
    })
    expect(parent?.delegatedParent).toBeUndefined()
  })

  it('keeps the summaries when the lookup fails or is missing', () => {
    const sessions = [summary('child')]
    expect(
      attachDelegatedParents(sessions, () => {
        throw new Error('db closed')
      })
    ).toEqual(sessions)
    expect(attachDelegatedParents(sessions, undefined)).toEqual(sessions)
  })

  it('does not query for an empty list', () => {
    const listLinks = vi.fn(() => [])
    expect(attachDelegatedParents([], listLinks)).toEqual([])
    expect(listLinks).not.toHaveBeenCalled()
  })
})
