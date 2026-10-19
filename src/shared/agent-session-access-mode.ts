/** Session-scoped access presets. `inherit` is universal; providers declare the explicit modes
 * they can apply before a session starts. */
export const AGENT_SESSION_ACCESS_MODES = ['default', 'full-access'] as const
export type AgentSessionAccessMode = (typeof AGENT_SESSION_ACCESS_MODES)[number]

/** Modes beyond the two legacy ones. They travel only as the string value of the `accessMode`
 * option and are declared separately from `AGENT_SESSION_ACCESS_MODES`, so a peer that predates
 * them never meets one in a strict two-value enum: it neither advertises nor accepts them. */
export const AGENT_SESSION_PERMISSION_PRESETS = [
  'auto',
  'accept-edits',
  'plan',
  'read-only'
] as const
export type AgentSessionPermissionPreset = (typeof AGENT_SESSION_PERMISSION_PRESETS)[number]

/** Any explicit (non-inherit) mode a session can run in. */
export type AgentSessionExplicitAccess = AgentSessionAccessMode | AgentSessionPermissionPreset

export const AGENT_SESSION_ACCESS_MODE_VALUES = [
  'inherit',
  ...AGENT_SESSION_ACCESS_MODES,
  ...AGENT_SESSION_PERMISSION_PRESETS
] as const
export type AgentSessionAccessModeValue = (typeof AGENT_SESSION_ACCESS_MODE_VALUES)[number]

export function isAgentSessionPermissionPreset(
  value: string
): value is AgentSessionPermissionPreset {
  return AGENT_SESSION_PERMISSION_PRESETS.some((preset) => preset === value)
}

export function isAgentSessionAccessModeValue(value: string): value is AgentSessionAccessModeValue {
  return (
    value === 'inherit' ||
    value === 'default' ||
    value === 'full-access' ||
    isAgentSessionPermissionPreset(value)
  )
}

export function supportsAgentSessionAccessMode(
  value: string,
  supported: readonly AgentSessionExplicitAccess[] | undefined
): value is AgentSessionAccessModeValue {
  return (
    value === 'inherit' ||
    ((value === 'default' || value === 'full-access' || isAgentSessionPermissionPreset(value)) &&
      supported?.includes(value) === true)
  )
}

/** The legacy two-value mode a peer that predates presets can be told for `value`: the closest one
 *  that is never wider. Every preset keeps approvals on, so only `full-access` maps to itself. */
export function legacyAgentSessionAccessMode(
  value: AgentSessionExplicitAccess
): AgentSessionAccessMode {
  return value === 'full-access' ? 'full-access' : 'default'
}

/** What an agent declares it can apply, resolved for the runtime a session uses. */
export type AgentSessionDeclaredAccess = {
  modes: readonly AgentSessionAccessMode[]
  presets: readonly AgentSessionPermissionPreset[]
  /** `modes` then `presets`: everything a pick may name besides `inherit`. */
  explicit: readonly AgentSessionExplicitAccess[]
}

type AccessDeclaration = {
  supportedAccessModes?: readonly AgentSessionAccessMode[]
  supportedPermissionPresets?: readonly AgentSessionPermissionPreset[]
  /** Replaces the agent-level declaration for a session on that runtime (Pi's Gentle Shell). */
  runtimeAccess?: Readonly<
    Record<
      string,
      {
        modes: readonly AgentSessionAccessMode[]
        presets?: readonly AgentSessionPermissionPreset[]
      }
    >
  >
}

const NO_PRESETS: readonly AgentSessionPermissionPreset[] = []

/** Undefined when the agent declares no explicit access modes at all. */
export function agentSessionDeclaredAccess(
  declaration: AccessDeclaration | undefined,
  runtime?: string
): AgentSessionDeclaredAccess | undefined {
  const override = runtime ? declaration?.runtimeAccess?.[runtime] : undefined
  const modes = override?.modes ?? declaration?.supportedAccessModes
  if (!modes) {
    return undefined
  }
  const presets =
    (override ? override.presets : declaration?.supportedPermissionPresets) ?? NO_PRESETS
  return { modes, presets, explicit: [...modes, ...presets] }
}

/** Resolve a session preset without mutating the user's global access setting. A preset other
 *  than `full-access` is never full access. */
export function resolveAgentSessionFullAccess(
  value: string | undefined,
  inheritedFullAccess: boolean
): boolean {
  if (value === undefined || value === 'inherit') {
    return inheritedFullAccess
  }
  if (value === 'default' || isAgentSessionPermissionPreset(value)) {
    return false
  }
  if (value === 'full-access') {
    return true
  }
  throw new Error('agent session access mode is invalid')
}

export type AgentSessionAccessOptions = {
  /** Advertised independently of model discovery; false while a provider child runs. `presets` is
   *  absent from an older host, which then offers only the two legacy modes. */
  accessModeSupport?: {
    modes: readonly AgentSessionAccessMode[]
    presets?: readonly AgentSessionPermissionPreset[]
    settable: boolean
    /** Explicit modes that may still be picked while a provider child runs. */
    liveModes?: readonly AgentSessionExplicitAccess[]
    /** Picks (`inherit` included) a running child already satisfies: taking one changes only what
     *  the session records, not what the child does. Absent from an older host. */
    recordOnlyModes?: readonly AgentSessionAccessModeValue[]
  }
  /** Session-only preset; absent from an older host's reply. */
  current: { accessMode?: AgentSessionAccessModeValue }
}
