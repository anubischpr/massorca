import type { AgentStatusOrchestrationContext } from './agent-status-types'

/** The session that delegated this one, from the host's record. Absent on older hosts. */
export type DelegatedSessionParent = {
  parentSessionId: string
  taskId: string
  dispatchId: string
  dispatchStatus?: AgentStatusOrchestrationContext['dispatchStatus']
}

export type SessionRestartResume = {
  phase: 'queued' | 'starting' | 'continued' | 'refused' | 'unconfirmed' | 'skipped'
}
