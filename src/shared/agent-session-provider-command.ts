// Commands a provider answers for its own chat, such as Codex's `/skills` or Pi's `/name`. The set is
// closed on the wire; which of them a session offers is the host's report (`providerCommands`).

export const AGENT_SESSION_PROVIDER_COMMANDS = [
  'usage',
  'skills',
  'plugins',
  'memories',
  'rename',
  'fork',
  'review',
  'approve',
  'stop',
  'name',
  'export'
] as const

export type AgentSessionProviderCommand = (typeof AGENT_SESSION_PROVIDER_COMMANDS)[number]

/** The longest argument a provider command takes: a name, review instructions or a path. */
export const AGENT_SESSION_PROVIDER_COMMAND_ARGUMENT_MAX_LENGTH = 4000

/** A newer host may report a command this build does not know; it is dropped, never offered. */
export function isAgentSessionProviderCommand(
  value: unknown
): value is AgentSessionProviderCommand {
  return AGENT_SESSION_PROVIDER_COMMANDS.some((command) => command === value)
}

/** A status row presentation: the chat draws the account's usage windows from its own snapshot,
 *  and a client that does not know it shows the row's text. */
export const CODEX_USAGE_NOTICE_PRESENTATION = 'codex-usage'

export type AgentSessionProviderCommandResult = {
  command: AgentSessionProviderCommand
  /** `fork`: the provider's own id for the new conversation, which the client opens as a chat. */
  forkedProviderSessionId?: string
  /** `rename` and `name`: the name now set, which the chat shows as its title. */
  conversationName?: string
}
