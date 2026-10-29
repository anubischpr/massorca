import type { AgentSessionConversationCommand } from '../../../src/shared/agent-session-conversation-command'
import type { SlashCommandSuggestion } from '../../../src/shared/native-chat-slash-commands'
import { structuredSlashCommands } from '../../../src/shared/structured-agent-session-composer'

// MassOrca's own prototype commands, offered in every structured chat beside the agent's commands.
// The message is planned by `planMobilePrototypeOutgoing`, never sent to the agent as a command.
const PROTOTYPE_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'prototype' },
  { name: 'prototipo' }
]

/** The chat's commands with the prototype commands in front, unless the chat already lists them. */
export function withPrototypeSlashCommands(
  commands: readonly SlashCommandSuggestion[]
): readonly SlashCommandSuggestion[] {
  return [
    ...PROTOTYPE_COMMANDS.filter(
      (command) => !commands.some((listed) => listed.name === command.name)
    ),
    ...commands
  ]
}

/** What a structured chat offers after `/`: the host's and the agent's commands, then ours. */
export function structuredChatSlashCommands(
  commands: readonly AgentSessionConversationCommand[],
  agent: Parameters<typeof structuredSlashCommands>[1]
): readonly SlashCommandSuggestion[] {
  return withPrototypeSlashCommands(structuredSlashCommands(commands, agent))
}
