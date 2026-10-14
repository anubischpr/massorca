import type { SessionOptionDescriptor } from './native-chat-session-options'
import type { StructuredAgentSessionOptionState } from './structured-agent-session-options'

export function structuredAgentSessionAccessOption(
  state: StructuredAgentSessionOptionState
): SessionOptionDescriptor | null {
  return state.accessModes
    ? {
        id: 'accessMode',
        label: 'accessMode',
        category: 'mode',
        kind: {
          type: 'select',
          currentValue: state.record.accessMode?.value ?? 'inherit',
          choices: [
            { value: 'inherit', label: 'inherit' },
            ...(state.accessModes.includes('default')
              ? [{ value: 'default', label: 'default' }]
              : []),
            ...(state.accessModes.includes('full-access')
              ? [{ value: 'full-access', label: 'full-access' }]
              : [])
          ]
        },
        valueSource: state.record.accessMode?.source ?? 'default',
        transport: 'agent-session',
        settable: state.accessModeSettable,
        ...(!state.accessModeSettable ? { disabledReason: 'set-when-session-starts' } : {})
      }
    : null
}

export function lockStructuredAgentSessionAccessOptions(
  snapshot: SessionOptionDescriptor[]
): SessionOptionDescriptor[] {
  return snapshot.map((descriptor) =>
    descriptor.id === 'accessMode'
      ? { ...descriptor, settable: false, disabledReason: 'set-when-session-starts' }
      : descriptor
  )
}
