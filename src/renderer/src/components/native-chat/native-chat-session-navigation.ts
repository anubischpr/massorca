import { translate } from '@/i18n/i18n'
import type { SlashCommandSuggestion } from '../../../../shared/native-chat-slash-commands'
import {
  getAgentSlashCommands,
  sessionSlashCommandSuggestions
} from '../../../../shared/native-chat-slash-commands'
import {
  getAgentCliCommands,
  getHostClaimedNativeChatCommands
} from '../../../../shared/native-chat-agent-profiles'
import { structuredSlashCommands } from '../../../../shared/structured-agent-session-composer'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'
import { nativeChatClientCommandRows } from './native-chat-client-commands'

/** These are window actions, independent of a provider's RPC command registry. */
function nativeChatSessionCommands(): readonly SlashCommandSuggestion[] {
  return [
    {
      name: 'resume',
      description: translate(
        'components.native-chat.composer.resumeWindowDescription',
        'Choose an existing session in the Sessions panel'
      )
    },
    {
      name: 'session',
      description: translate(
        'components.native-chat.composer.sessionWindowDescription',
        'Browse sessions in the Sessions panel'
      )
    },
    {
      name: 'prototype',
      description: translate(
        'components.native-chat.composer.prototypeCommandDescription',
        'Make HTML prototypes of an idea'
      )
    },
    // Claimed so `/prototipo` is answered like `/prototype`; never listed beside it.
    { name: 'prototipo', hidden: true }
  ]
}

export function isNativeChatSessionNavigation(text: string): boolean {
  return /^\/(?:resume|session)\s*$/i.test(text.trim())
}

export async function openNativeChatSessionNavigation(): Promise<void> {
  const { useAppStore } = await import('@/store')
  const state = useAppStore.getState()
  state.setRightSidebarTab('vault')
  state.setRightSidebarOpen(true)
}

/** `/diff`: the workspace's source-control view, in the right sidebar. */
export async function openNativeChatSourceControl(): Promise<boolean> {
  const { useAppStore } = await import('@/store')
  const state = useAppStore.getState()
  state.setRightSidebarTab('source-control')
  state.setRightSidebarOpen(true)
  return true
}

export function withNativeChatSessionCommands(
  commands: readonly SlashCommandSuggestion[],
  agent?: AgentType
): readonly SlashCommandSuggestion[] {
  const sessionCommands = nativeChatSessionCommands()
  const names = new Set(sessionCommands.map((entry) => entry.name))
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
    ...sessionCommands,
    ...terminalCommands
  ]
}

const PROVIDER_COMMAND_ARGUMENT_HINTS: Partial<Record<string, string>> = {
  rename: '<name>',
  name: '<name>',
  review: '[instructions]',
  memories: '[on|off]',
  export: '[path]'
}

/** The rows for commands the host runs for this session, described as the agent's catalog does. */
function providerCommandRows(
  agent: AgentType,
  transport: Pick<
    NativeChatStructuredComposerTransport,
    'providerCommands' | 'backgroundTasksReveal'
  >
): SlashCommandSuggestion[] {
  const names = [
    ...(transport.providerCommands ?? []),
    ...(transport.backgroundTasksReveal ? ['ps'] : [])
  ]
  const catalog = getAgentSlashCommands(agent)
  return names.map((name) => {
    const hint = PROVIDER_COMMAND_ARGUMENT_HINTS[name]
    const description = catalog.find((entry) => entry.name === name)?.description
    return {
      name,
      ...(description ? { description } : {}),
      ...(hint ? { argumentHint: hint } : {})
    }
  })
}

export function nativeChatStructuredCatalog(
  agent: AgentType,
  transport: Pick<
    NativeChatStructuredComposerTransport,
    | 'sessionFunctions'
    | 'sessionCommands'
    | 'conversationCommands'
    | 'providerCommands'
    | 'backgroundTasksReveal'
  >
): readonly SlashCommandSuggestion[] {
  const { sessionFunctions, sessionCommands, conversationCommands } = transport
  const base: readonly SlashCommandSuggestion[] =
    sessionFunctions !== undefined
      ? sessionFunctions.map((entry) => ({ ...entry, providerFunction: entry }))
      : sessionCommands !== undefined
        ? sessionSlashCommandSuggestions(agent, sessionCommands)
        : structuredSlashCommands(conversationCommands, agent)
  // A running session reports no CLI-owned commands (agy's `/grill-me`), so they join every report.
  const extra = [
    ...providerCommandRows(agent, transport),
    ...nativeChatClientCommandRows(agent),
    ...getAgentCliCommands(agent)
  ]
  const listed = new Set(base.map((entry) => entry.name))
  return withNativeChatSessionCommands(
    [
      ...base,
      ...extra.filter((row) => {
        const fresh = !listed.has(row.name)
        listed.add(row.name)
        return fresh
      })
    ],
    agent
  )
}
