import type { AgentStatusOrchestrationContext } from '../../shared/agent-status-types'
import { buildOrchestrationTaskDisplayMetadata } from '../../shared/orchestration-task-display'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import type { OrchestrationDb } from './orchestration/db'
import type { DelegatedChildLinkRow } from './orchestration/db/delegation/delegation-request-store'

/** The pane key a structured session's agent row is published under, from its own session id. */
export function structuredRowPaneKey(sessionId: string): string {
  return structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)
}

/** The session ids that have a structured row among these pane keys; a session with no row is gone. */
export function structuredSessionIdsOfRows(paneKeys: readonly string[]): Set<string> {
  const prefix = structuredAgentSessionTabId('')
  const sessionIds = new Set<string>()
  for (const paneKey of paneKeys) {
    const colon = paneKey.indexOf(':')
    if (paneKey.startsWith(prefix) && colon > prefix.length) {
      sessionIds.add(paneKey.slice(prefix.length, colon))
    }
  }
  return sessionIds
}

/** Nests each delegated child under the chat that asked for it, from the persisted record. */
export function applyDelegatedChildParentLinks(
  contexts: Record<string, AgentStatusOrchestrationContext>,
  db: OrchestrationDb,
  paneKeys: readonly string[]
): void {
  // Why: a session with no row is gone, so links are read only between sessions that still show.
  const shown = [...structuredSessionIdsOfRows(paneKeys)]
  if (shown.length === 0) {
    return
  }
  for (const link of db.listDelegatedChildLinks?.(shown) ?? []) {
    const paneKey = structuredRowPaneKey(link.child_session_id)
    const parentPaneKey = structuredRowPaneKey(link.parent_session_id)
    const live = contexts[paneKey]
    // Why: a live context keeps its own dispatch; the record only supplies the parent.
    contexts[paneKey] = live
      ? { ...live, parentPaneKey }
      : recordedChildContext(link, parentPaneKey)
  }
}

function recordedChildContext(
  link: DelegatedChildLinkRow,
  parentPaneKey: string
): AgentStatusOrchestrationContext {
  const display =
    link.task_spec === null
      ? null
      : buildOrchestrationTaskDisplayMetadata({
          spec: link.task_spec,
          taskTitle: link.task_title,
          displayName: link.display_name
        })
  return {
    taskId: link.task_id,
    dispatchId: link.dispatch_id,
    ...(link.dispatch_status ? { dispatchStatus: link.dispatch_status } : {}),
    ...(display?.taskTitle ? { taskTitle: display.taskTitle } : {}),
    ...(display?.displayName ? { displayName: display.displayName } : {}),
    ...(link.run_id ? { orchestrationRunId: link.run_id } : {}),
    parentPaneKey
  }
}
