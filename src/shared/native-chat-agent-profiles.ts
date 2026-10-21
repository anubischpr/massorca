import type { AgentType } from './agent-status-types'
import { CODEX_TEXT_COMMANDS } from './agent-tui-slash-menus'
import {
  ANTIGRAVITY_CLI_COMMANDS,
  getAgentSlashCommands,
  type NativeChatCommandReply,
  type SlashCommandSuggestion
} from './native-chat-slash-commands'

export type NativeChatAgentProfile = {
  skillPrefix: '$' | '/'
  /** OpenClaude reads Claude-owned roots, so this can differ from the agent. */
  skillSourceOwner: AgentType
  /** The agent's own harness expands a slash command out of the message text, so
   *  the chat host claims only the commands it implements itself. */
  expandsSlashCommandsFromText?: true
  /** Catalog commands the model acts on when they arrive as prose, even though
   *  the runtime has no slash parser of its own. */
  textDrivenCommands?: readonly string[]
  /** The CLI's own command list, offered by a structured chat whose session reports none. */
  cliCommands?: readonly SlashCommandSuggestion[]
}

const NATIVE_CHAT_AGENT_PROFILES: Partial<Record<AgentType, NativeChatAgentProfile>> = {
  codex: {
    skillPrefix: '$',
    skillSourceOwner: 'codex',
    // The app-server has no slash parser, but the model owns goal tools and
    // calls create_goal itself when `/goal <objective>` reaches it as prose. `/init`, `/recap` and
    // `/plan` reach it as the same literal text: unverified, since the schema of Codex 0.159.2 has no
    // request that sets the collaboration mode for the next turn, and the TUI's prompts are not reproduced.
    textDrivenCommands: ['goal', 'init', 'recap', 'plan'],
    cliCommands: CODEX_TEXT_COMMANDS
  },
  claude: {
    skillPrefix: '/',
    skillSourceOwner: 'claude',
    expandsSlashCommandsFromText: true
  },
  openclaude: {
    skillPrefix: '/',
    skillSourceOwner: 'claude',
    expandsSlashCommandsFromText: true
  },
  opencode: { skillPrefix: '/', skillSourceOwner: 'opencode', expandsSlashCommandsFromText: true },
  opencode2: {
    skillPrefix: '/',
    skillSourceOwner: 'opencode2',
    expandsSlashCommandsFromText: true
  },
  grok: {
    skillPrefix: '/',
    skillSourceOwner: 'grok'
  },
  // Why: agy expands `/name` commands and skills in print mode unless `--disable-slash-commands`
  // is passed, and Orca never passes it (see antigravity-usage-command.ts, verified on agy 1.2.11).
  antigravity: {
    skillPrefix: '/',
    skillSourceOwner: 'antigravity',
    expandsSlashCommandsFromText: true,
    cliCommands: ANTIGRAVITY_CLI_COMMANDS
  }
}

/** The CLI's own commands, for a structured chat whose session reports none (agy: its `/help`). */
export function getAgentCliCommands(
  agent: AgentType | null | undefined
): readonly SlashCommandSuggestion[] {
  return (agent ? getNativeChatAgentProfile(agent)?.cliCommands : undefined) ?? []
}

export function getNativeChatAgentProfile(
  agent: AgentType | null | undefined
): NativeChatAgentProfile | null {
  return agent ? (NATIVE_CHAT_AGENT_PROFILES[agent] ?? null) : null
}

/** The catalog that send classification, collision detection, and transcript
 *  envelope surfacing key off. Grok has no verified catalog yet, so its slash
 *  surface stays skills-only — this is the single place that policy lives. */
export function getVerifiedNativeChatCommands(agent: AgentType): readonly SlashCommandSuggestion[] {
  return agent === 'grok' ? [] : getAgentSlashCommands(agent)
}

/** How the chat finds the reply to a verified command over a terminal session;
 *  null when the agent answers it in the terminal or the command is unknown. */
export function getNativeChatCommandReply(
  agent: AgentType,
  commandName: string
): NativeChatCommandReply | null {
  return (
    getVerifiedNativeChatCommands(agent).find((command) => command.name === commandName)?.reply ??
    null
  )
}

/** The verified catalog minus commands only the desktop chat answers: a surface
 *  without the composer's answers or the transcript's reply rows (mobile) would
 *  offer a command that appears to do nothing. */
export function getAgentAnsweredNativeChatCommands(
  agent: AgentType
): readonly SlashCommandSuggestion[] {
  return getVerifiedNativeChatCommands(agent).filter((command) => command.reply === undefined)
}

/** The mirror of the claimed set: catalog commands this agent acts on when they
 *  arrive as message text. The picker offers these too, so a command the agent
 *  implements is discoverable and not merely typable. */
export function getTextDrivenNativeChatCommands(
  agent: AgentType | null | undefined
): readonly SlashCommandSuggestion[] {
  if (!agent) {
    return []
  }
  const names = new Set(getNativeChatAgentProfile(agent)?.textDrivenCommands ?? [])
  return names.size === 0
    ? []
    : getVerifiedNativeChatCommands(agent).filter((command) => names.has(command.name))
}

/** Catalog commands the chat host answers itself. Whatever is left over reaches
 *  the agent as ordinary text, which is only correct where the agent implements
 *  the command — so an agent unclaims a command only via the profile above.
 *  Claiming stays the default: it is what stops a hand-typed `/clear` from being
 *  sent to the model as literal prompt text. */
export function getHostClaimedNativeChatCommands(
  agent: AgentType
): readonly SlashCommandSuggestion[] {
  const profile = getNativeChatAgentProfile(agent)
  if (profile?.expandsSlashCommandsFromText) {
    return []
  }
  const passedThrough = new Set(profile?.textDrivenCommands ?? [])
  return getVerifiedNativeChatCommands(agent).filter((command) => !passedThrough.has(command.name))
}
