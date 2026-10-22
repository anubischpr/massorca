import type { AgentSessionProviderCommand } from '../../../shared/agent-session-provider-command'

/** What a provider command answered. The notice becomes a status row of the chat. */
export type AgentSessionProviderCommandOutcome =
  | {
      ok: true
      notice?: { text: string; presentation?: string; tone?: 'notice' | 'warning' }
      /** `fork`: the provider's own id for the new conversation. */
      forkedProviderSessionId?: string
      /** `rename`: the name the chat now carries as its title. */
      conversationName?: string
    }
  | { ok: false; rejected: string }

/** The adapter methods behind `capabilities.providerCommands`. */
export type ProviderCommandAdapter = {
  /** Runs a provider command declared in `capabilities.providerCommands`. `rejected` is the provider
   *  refusing it; a method the provider's version lacks answers a `notice` saying so instead. A throw
   *  leaves its effect unknown. */
  runProviderCommand?(input: {
    sessionId: string
    fence: number
    command: AgentSessionProviderCommand
    argument?: string
  }): Promise<AgentSessionProviderCommandOutcome>
  /** Of the declared provider commands, those this live session can run now (`/approve` only while
   *  an action awaits it); undefined offers every declared one. */
  availableProviderCommands?(sessionId: string): readonly AgentSessionProviderCommand[] | undefined
}
