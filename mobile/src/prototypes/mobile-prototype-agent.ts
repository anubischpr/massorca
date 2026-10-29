import { formatAgentRowTypeLabel, type PiRowRuntime } from '../../../src/shared/agent-type-label'
import type { PrototypeAgent } from '../../../src/shared/prototype-request'

/** Which prototype agent a chat is. Only a Pi chat that runs Gentle Shell is `gentle-shell`. */
export function mobilePrototypeAgentFor(
  agent: string | null | undefined,
  piRuntime: PiRowRuntime | undefined
): PrototypeAgent {
  if (agent === 'claude' || agent === 'codex' || agent === 'antigravity') {
    return agent
  }
  return agent === 'pi' && piRuntime === 'gentle-shell' ? 'gentle-shell' : 'other'
}

/** The name the count card gives the chat's agent. */
export function mobilePrototypeAgentName(
  agent: string | null | undefined,
  piRuntime: PiRowRuntime | undefined
): string {
  return formatAgentRowTypeLabel({ agentType: agent }, piRuntime)
}
