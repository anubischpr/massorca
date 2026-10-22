import type { AgentType } from '../../../../shared/agent-status-types'
import { getHostClaimedNativeChatCommands } from '../../../../shared/native-chat-agent-profiles'
import type { SlashCommandSuggestion } from '../../../../shared/native-chat-slash-commands'
import type { StructuredAgentSessionClientCommandSurface } from '../../../../shared/structured-agent-session-client-command-dispatch'

// Answered by the chat for every agent.
const EVERY_AGENT_COMMANDS: readonly string[] = ['status', 'context', 'permissions', 'copy']

// Answered by the chat for one agent: Codex's `/export` and `/mention`; agy's `/open`, which is the
// same surface as `/mention`, and `/rename`.
const AGENT_COMMANDS: Partial<Record<AgentType, readonly string[]>> = {
  codex: ['export', 'mention'],
  antigravity: ['open', 'rename']
}

export function nativeChatClientCommandNames(agent: AgentType): readonly string[] {
  return [...EVERY_AGENT_COMMANDS, ...(AGENT_COMMANDS[agent] ?? [])]
}

/** The menu rows for client commands the agent's catalog already claims, so they are not shown as terminal-only. */
export function nativeChatClientCommandRows(agent: AgentType): SlashCommandSuggestion[] {
  const names = new Set(nativeChatClientCommandNames(agent))
  return getHostClaimedNativeChatCommands(agent)
    .filter((entry) => names.has(entry.name))
    .map(({ name, description }) => ({ name, ...(description ? { description } : {}) }))
}

export type NativeChatClientCommandActions = {
  status: () => boolean
  context: () => boolean
  permissions: () => Promise<boolean>
  copy: () => Promise<boolean>
  export: () => Promise<boolean>
  mention: (query: string) => boolean
  rename: (name: string | null) => boolean
}

/** The client commands one agent's chat answers; every other `/name` reaches the agent or the provider as before. */
export function nativeChatClientCommandSurface(
  agent: AgentType,
  actions: NativeChatClientCommandActions
): StructuredAgentSessionClientCommandSurface {
  return {
    status: actions.status,
    context: actions.context,
    permissions: actions.permissions,
    copy: actions.copy,
    ...(agent === 'codex' ? { export: actions.export, mention: actions.mention } : {}),
    ...(agent === 'antigravity' ? { open: actions.mention, rename: actions.rename } : {})
  }
}
