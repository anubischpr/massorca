import { agentSessionRefusalError } from '../../shared/agent-session-wire-refusals'

const TERMINAL_HOLDS_MESSAGE =
  'A terminal is still running this conversation. Close it to continue here.'

type ProviderSessionIdentity = { paneKey: string; sessionId: string }

/** The first terminal pane whose live PTY still reports this provider session. */
export function findLiveTerminalHoldingProviderSession(input: {
  identities: readonly ProviderSessionIdentity[]
  providerSessionId: string
  isPaneKeyPtyLive: (paneKey: string) => boolean
}): ProviderSessionIdentity | null {
  return (
    input.identities.find(
      (identity) =>
        identity.sessionId === input.providerSessionId && input.isPaneKeyPtyLive(identity.paneKey)
    ) ?? null
  )
}

/** Adopting under a running TUI would put two provider processes on one conversation. */
export function assertNoLiveTerminalHoldsProviderSession(
  input: Parameters<typeof findLiveTerminalHoldingProviderSession>[0]
): void {
  if (findLiveTerminalHoldingProviderSession(input)) {
    // ownerAlive: the existing conflict reason for a live process that owns the conversation.
    throw agentSessionRefusalError(
      'agent_session_conflict',
      { reason: 'ownerAlive' },
      TERMINAL_HOLDS_MESSAGE
    )
  }
}
