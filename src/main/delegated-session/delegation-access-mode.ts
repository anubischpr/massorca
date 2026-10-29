import {
  isAgentSessionAccessModeValue,
  type AgentSessionAccessModeValue,
  type AgentSessionDeclaredAccess
} from '../../shared/agent-session-access-mode'

/**
 * The access a child asks worker-start for: the parent's own, copied and never widened. Nothing is
 * asked when the parent follows the global setting, when the child's agent declares no explicit
 * modes (a protocol-driven agent refuses one), or when the agent is Pi and the mode is `default`
 * (stock Pi's declaration omits it). Worker-start then narrows what the agent cannot apply to the
 * safest declared mode, and refuses the start when none is narrow enough.
 */
export function delegationChildAccessMode(input: {
  childAgent: string
  parentAccessMode: string | undefined
  childDeclaredAccess: AgentSessionDeclaredAccess | undefined
}): AgentSessionAccessModeValue | undefined {
  const mode = input.parentAccessMode
  if (mode === undefined || mode === 'inherit' || !isAgentSessionAccessModeValue(mode)) {
    return undefined
  }
  if (!input.childDeclaredAccess || input.childDeclaredAccess.explicit.length === 0) {
    return undefined
  }
  if (input.childAgent === 'pi' && mode === 'default') {
    return undefined
  }
  return mode
}
