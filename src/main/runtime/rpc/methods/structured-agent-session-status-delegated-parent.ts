import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import type { DelegatedChildLinkRow } from '../../orchestration/db/delegation/delegation-request-store'

/**
 * Stamps each delegated child with the session that asked for it, from the persisted record. A paired
 * client has no other way to learn this link, and it outlives the child's dispatch. A failed lookup
 * leaves the summaries as they are: the rows still list, only without their nesting.
 */
export function attachDelegatedParents(
  sessions: readonly AgentSessionStatusSummary[],
  listLinks: ((sessionIds: readonly string[]) => DelegatedChildLinkRow[]) | undefined
): AgentSessionStatusSummary[] {
  if (!listLinks || sessions.length === 0) {
    return [...sessions]
  }
  let links: DelegatedChildLinkRow[]
  try {
    links = listLinks(sessions.map((session) => session.sessionId))
  } catch {
    return [...sessions]
  }
  const linkByChild = new Map(links.map((link) => [link.child_session_id, link]))
  return sessions.map((session) => {
    const link = linkByChild.get(session.sessionId)
    return link
      ? {
          ...session,
          delegatedParent: {
            parentSessionId: link.parent_session_id,
            taskId: link.task_id,
            dispatchId: link.dispatch_id,
            ...(link.dispatch_status ? { dispatchStatus: link.dispatch_status } : {})
          }
        }
      : session
  })
}
