/** Session-scoped access presets. `inherit` is universal; providers declare the explicit modes
 * they can apply before a session starts. */
export const AGENT_SESSION_ACCESS_MODES = ['default', 'full-access'] as const
export type AgentSessionAccessMode = (typeof AGENT_SESSION_ACCESS_MODES)[number]
export const AGENT_SESSION_ACCESS_MODE_VALUES = ['inherit', ...AGENT_SESSION_ACCESS_MODES] as const
export type AgentSessionAccessModeValue = (typeof AGENT_SESSION_ACCESS_MODE_VALUES)[number]

export function isAgentSessionAccessModeValue(value: string): value is AgentSessionAccessModeValue {
  return value === 'inherit' || value === 'default' || value === 'full-access'
}

export function supportsAgentSessionAccessMode(
  value: string,
  supported: readonly AgentSessionAccessMode[] | undefined
): value is AgentSessionAccessModeValue {
  return (
    value === 'inherit' ||
    ((value === 'default' || value === 'full-access') && supported?.includes(value) === true)
  )
}

/** Resolve a session preset without mutating the user's global access setting. */
export function resolveAgentSessionFullAccess(
  value: string | undefined,
  inheritedFullAccess: boolean
): boolean {
  if (value === undefined || value === 'inherit') {
    return inheritedFullAccess
  }
  if (value === 'default') {
    return false
  }
  if (value === 'full-access') {
    return true
  }
  throw new Error('agent session access mode is invalid')
}

export type AgentSessionAccessOptions = {
  /** Advertised independently of model discovery; false while a provider child runs. */
  accessModeSupport?: { modes: readonly AgentSessionAccessMode[]; settable: boolean }
  /** Session-only preset; absent from an older host's reply. */
  current: { accessMode?: AgentSessionAccessModeValue }
}
