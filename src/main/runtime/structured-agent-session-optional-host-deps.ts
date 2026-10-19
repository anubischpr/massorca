import type { StructuredAgentSessionHostDeps } from '../native-chat/agent-session-wire/structured-agent-session-host-types'
import type { StructuredAgentSessionRuntimeDeps } from './structured-agent-session-runtime'

/** The host dependencies a runtime passes through only when it has them. */
export function optionalStructuredHostDeps(
  deps: Pick<
    StructuredAgentSessionRuntimeDeps,
    | 'onSessionStatusChanged'
    | 'statusSink'
    | 'hasOpenDispatch'
    | 'replySuggestions'
    | 'resolveAgentFullAccess'
    | 'onSessionTabHidden'
  >
): Partial<StructuredAgentSessionHostDeps> {
  return {
    ...(deps.onSessionStatusChanged ? { onSessionStatusChanged: deps.onSessionStatusChanged } : {}),
    ...(deps.statusSink ? { statusSink: deps.statusSink } : {}),
    ...(deps.hasOpenDispatch ? { hasOpenDispatch: deps.hasOpenDispatch } : {}),
    ...(deps.replySuggestions ? { replySuggestions: deps.replySuggestions } : {}),
    // Whether `inherit` access means full access is the same global answer the adapters launch from.
    ...(deps.resolveAgentFullAccess
      ? { resolveInheritedFullAccess: deps.resolveAgentFullAccess }
      : {}),
    ...(deps.onSessionTabHidden ? { onSessionTabHidden: deps.onSessionTabHidden } : {})
  }
}
