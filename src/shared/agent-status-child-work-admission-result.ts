import type { AgentChildWorkAdmissionResult } from './agent-status-child-work-admission'

export function rejectAgentChildWorkAdmission(
  reason: Extract<AgentChildWorkAdmissionResult, { accepted: false }>['reason']
) {
  return { accepted: false, reason } as const
}
