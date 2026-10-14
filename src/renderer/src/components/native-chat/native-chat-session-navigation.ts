import type { SlashCommandSuggestion } from '../../../../shared/native-chat-slash-commands'
import { sessionSlashCommandSuggestions } from '../../../../shared/native-chat-slash-commands'
import { getHostClaimedNativeChatCommands } from '../../../../shared/native-chat-agent-profiles'
import { structuredSlashCommands } from '../../../../shared/structured-agent-session-composer'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'

/** These are window actions, independent of a provider's RPC command registry. */
export const NATIVE_CHAT_SESSION_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'resume', description: 'Choose an existing session in the Sessions panel' },
  { name: 'session', description: 'Browse sessions in the Sessions panel' }
]

export function isNativeChatSessionNavigation(text: string): boolean {
  return /^\/(?:resume|session)\s*$/i.test(text.trim())
}

export async function openNativeChatSessionNavigation(): Promise<void> {
  const { useAppStore } = await import('@/store')
  const state = useAppStore.getState()
  state.setRightSidebarTab('vault')
  state.setRightSidebarOpen(true)
}

export function withNativeChatSessionCommands(
  commands: readonly SlashCommandSuggestion[],
  agent?: AgentType
): readonly SlashCommandSuggestion[] {
  const names = new Set(NATIVE_CHAT_SESSION_COMMANDS.map((entry) => entry.name))
  const offered = new Set([...names, ...commands.map((entry) => entry.name)])
  const terminalCommands: SlashCommandSuggestion[] = (
    agent ? getHostClaimedNativeChatCommands(agent) : []
  )
    .filter((entry) => !offered.has(entry.name))
    .map((entry) => ({
      ...entry,
      providerFunction: {
        name: entry.name,
        description: entry.description,
        provenance: 'orca',
        availability: 'terminal-only',
        execution: { kind: 'terminal' }
      }
    }))
  return [
    ...commands.filter((entry) => !names.has(entry.name)),
    ...NATIVE_CHAT_SESSION_COMMANDS,
    ...terminalCommands
  ]
}

export function nativeChatStructuredCatalog(
  agent: AgentType,
  transport: Pick<
    NativeChatStructuredComposerTransport,
    'sessionFunctions' | 'sessionCommands' | 'conversationCommands'
  >
): readonly SlashCommandSuggestion[] {
  const { sessionFunctions, sessionCommands, conversationCommands } = transport
  return withNativeChatSessionCommands(
    sessionFunctions !== undefined
      ? sessionFunctions.map((entry) => ({ ...entry, providerFunction: entry }))
      : sessionCommands !== undefined
        ? sessionSlashCommandSuggestions(agent, sessionCommands)
        : structuredSlashCommands(conversationCommands, agent),
    agent
  )
}
