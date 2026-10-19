import {
  isAgentSessionPermissionPreset,
  type AgentSessionAccessMode,
  type AgentSessionExplicitAccess
} from './agent-session-access-mode'
import type { SessionOptionDescriptor } from './native-chat-session-options'
import type { StructuredAgentSessionOptionState } from './structured-agent-session-options'

/** The one access a provider with no restricted mode runs every chat in: it declares `full-access`
 *  and not `default`. Null when the provider offers a restricted mode to choose. */
export function providerFixedAccessMode(
  modes: readonly AgentSessionAccessMode[] | undefined
): 'full-access' | null {
  return modes?.includes('full-access') && !modes.includes('default') ? 'full-access' : null
}

/** Menu order: the approval-asking modes first, `full-access` last. */
const EXPLICIT_ACCESS_ORDER: readonly AgentSessionExplicitAccess[] = [
  'default',
  'auto',
  'accept-edits',
  'plan',
  'read-only',
  'full-access'
]

/** The access a session create asks for. Stock Pi has no restricted mode, so every such chat asks
 *  for full access, including one whose stored choice is `inherit`; the host still refuses
 *  restricted stock Pi. Create carries only the two legacy values; a preset rides the access option
 *  once the chat exists, and its closest never-wider legacy value is what create is told. */
export function createAccessModeFor(
  agent: string,
  requested: string | undefined,
  piRuntime?: string
): 'default' | 'full-access' | undefined {
  if (agent === 'pi' && piRuntime !== 'gentle-shell') {
    return 'full-access'
  }
  if (requested === 'default' || requested === 'full-access') {
    return requested
  }
  return requested !== undefined && isAgentSessionPermissionPreset(requested)
    ? 'default'
    : undefined
}

export function structuredAgentSessionAccessOption(
  state: StructuredAgentSessionOptionState
): SessionOptionDescriptor | null {
  const modes = state.accessModes
  if (!modes) {
    return null
  }
  const explicit: readonly AgentSessionExplicitAccess[] = [
    ...modes,
    ...(state.permissionPresets ?? [])
  ]
  // A running child keeps its mode unless its adapter can switch it; the rest wait for a start.
  const live = [...(state.liveAccessModes ?? []), ...(state.recordOnlyAccessModes ?? [])]
  const settable = state.accessModeSettable || live.length > 0
  const startOnly = (mode: string) =>
    !state.accessModeSettable && !live.some((liveMode) => liveMode === mode)
  const recorded = state.record.accessMode
  const fixed = providerFixedAccessMode(modes)
  if (fixed) {
    // Why: `inherit` resolves to restricted for such a provider, so the one explicit mode is the whole choice.
    return {
      id: 'accessMode',
      label: 'accessMode',
      category: 'mode',
      kind: { type: 'select', currentValue: fixed, choices: [{ value: fixed, label: fixed }] },
      valueSource: recorded?.value === fixed ? recorded.source : 'default',
      transport: 'agent-session',
      settable: state.accessModeSettable,
      note: 'no-restricted-mode',
      ...(!state.accessModeSettable ? { disabledReason: 'set-when-session-starts' } : {})
    }
  }
  return {
    id: 'accessMode',
    label: 'accessMode',
    category: 'mode',
    kind: {
      type: 'select',
      currentValue: recorded?.value ?? 'inherit',
      choices: [
        { value: 'inherit', label: 'inherit', ...(startOnly('inherit') ? { disabled: true } : {}) },
        ...EXPLICIT_ACCESS_ORDER.filter((mode) => explicit.includes(mode)).map((mode) => ({
          value: mode,
          label: mode,
          ...(startOnly(mode) ? { disabled: true } : {})
        }))
      ]
    },
    valueSource: recorded?.source ?? 'default',
    transport: 'agent-session',
    settable,
    ...(state.inheritedAccess ? { inheritedAccess: state.inheritedAccess } : {}),
    ...(!settable ? { disabledReason: 'set-when-session-starts' as const } : {}),
    ...(settable && !state.accessModeSettable ? { note: 'start-only-modes' as const } : {})
  }
}

/** A provider child runs: the access mode is fixed except for the modes it can switch to live. */
export function lockStructuredAgentSessionAccessOptions(
  snapshot: SessionOptionDescriptor[],
  liveModes: readonly string[] = []
): SessionOptionDescriptor[] {
  return snapshot.map((descriptor) => {
    if (descriptor.id !== 'accessMode') {
      return descriptor
    }
    if (liveModes.length === 0 || descriptor.kind.type !== 'select') {
      return { ...descriptor, settable: false, disabledReason: 'set-when-session-starts' }
    }
    return {
      ...descriptor,
      settable: true,
      note: 'start-only-modes',
      kind: {
        ...descriptor.kind,
        choices: descriptor.kind.choices.map((choice) =>
          liveModes.includes(choice.value) ? choice : { ...choice, disabled: true }
        )
      }
    }
  })
}
