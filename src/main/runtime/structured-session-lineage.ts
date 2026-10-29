import type { AgentStatusOrchestrationContext } from '../../shared/agent-status-types'
import { buildOrchestrationTaskDisplayMetadata } from '../../shared/orchestration-task-display'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import type { DelegatedChildLinkRow } from './orchestration/db/delegation/delegation-request-store'

/** The pane key a structured session's agent row is published under, from its own session id. */
export function structuredRowPaneKey(sessionId: string): string {
  return structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)
}

/** Nests each delegated child under the chat that asked for it, from the persisted record. */
export function applyDelegatedChildParentLinks(
  contexts: Record<string, AgentStatusOrchestrationContext>,
  links: readonly DelegatedChildLinkRow[]
): void {
  for (const link of links) {
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
