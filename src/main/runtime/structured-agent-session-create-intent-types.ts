import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'

export type StructuredAgentSessionCreateIntentInput = {
  envelope: { sessionId: string; clientOperationId: string }
  worktree: string
  agent: StructuredAgentId
  piRuntime?: PiRuntimeSelection
  accessMode?: 'default' | 'full-access'
  callerKey?: string
  resumeFrom?: { providerSessionId: string }
}
