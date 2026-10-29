import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import {
  isAgentSessionAccessModeValue,
  type AgentSessionAccessModeValue,
  type AgentSessionDeclaredAccess
} from '../../shared/agent-session-access-mode'

/**
 * The access a child asks worker-start for: the parent's own, copied and never widened. Nothing is
 * asked when the parent follows the global setting or is unrestricted (`full-access`), or when the
 * agent is Pi and the mode is `default` (stock Pi's declaration omits it). An agent that declares
 * no explicit modes (a protocol-driven agent refuses one) cannot be held to a restriction, so its
 * start is refused. Worker-start narrows what the agent cannot apply to the safest declared mode.
 */
export function delegationChildAccessMode(input: {
  childAgent: string
  parentAccessMode: string | undefined
  childDeclaredAccess: AgentSessionDeclaredAccess | undefined
}): AgentSessionAccessModeValue | undefined {
  const mode = input.parentAccessMode
  if (mode === undefined || mode === 'inherit') {
    return undefined
  }
  // Why: an unknown mode must not fall back to the global setting, which may be wider.
  if (!isAgentSessionAccessModeValue(mode)) {
    throw new OrchestrationError(
      'delegation_start_failed',
      "This chat's access mode is not one this version knows, so the child was not started."
    )
  }
  if (!input.childDeclaredAccess || input.childDeclaredAccess.explicit.length === 0) {
    if (mode === 'full-access') {
      return undefined
    }
    throw new OrchestrationError(
      'delegation_start_failed',
      `${input.childAgent} cannot be held to this chat's ${mode} access, so it was not started.`
    )
  }
  if (input.childAgent === 'pi' && mode === 'default') {
    return undefined
  }
  return mode
}
