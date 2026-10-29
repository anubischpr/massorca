// Which prototype agent a chat is, and the name its card shows.
import type { AgentType } from '../../../../shared/agent-status-types'
import type { PrototypeAgent } from '../../../../shared/prototype-request'
import { piRuntimeLabel, type PiDisplayRuntime } from '@/lib/pi-agent-display'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'

export function prototypeAgentForChat(
  agent: AgentType,
  piRuntime: PiDisplayRuntime
): PrototypeAgent {
  if (agent === 'claude') {
    return 'claude'
  }
  if (agent === 'codex') {
    return 'codex'
  }
  if (agent === 'antigravity') {
    return 'antigravity'
  }
  return agent === 'pi' && piRuntime === 'gentle-shell' ? 'gentle-shell' : 'other'
}

export function prototypeAgentDisplayName(agent: AgentType, piRuntime: PiDisplayRuntime): string {
  return agent === 'pi' ? piRuntimeLabel(piRuntime) : formatAgentTypeLabel(agent)
}
