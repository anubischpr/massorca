// Single source of truth for native chat slash-command behavior, shared by the
// desktop renderer and the mobile app. This is pure data + string helpers (no
// DOM, no RN-only imports), so both platforms import the SAME values — no
// mirrored copy to drift, unlike the agent-specific parsers in src/shared that
// Metro forces us to duplicate.

import type { AgentSessionProviderFunction } from './agent-session-provider-functions'
import type { AgentSessionSlashCommand } from './agent-session-wire'
import type { AgentType } from './agent-status-types'

/** Where the chat finds a command's reply when the agent runs in a terminal.
 *  `composer`: the chat answers from state it holds and never sends the command.
 *  `transcript`: the agent writes its reply as a transcript row the chat shows.
 *  Absent: the agent answers in its own terminal, or the effect is the answer. */
import { ANTIGRAVITY_CLI_COMMANDS, CODEX_COMMANDS } from './agent-tui-slash-menus'

export { ANTIGRAVITY_CLI_COMMANDS }

export type NativeChatCommandReply = 'composer' | 'transcript'

export type SlashCommandSuggestion = {
  /** The command token without its leading slash, e.g. `clear`. */
  name: string
  /** Optional one-line description for the suggestion row. */
  description?: string
  /** Provider-authored argument sketch, e.g. `<objective>`. */
  argumentHint?: string
  kindUnspecified?: true
  providerFunction?: AgentSessionProviderFunction
  /** Declared only on curated rows; a surface that cannot show the reply drops the row. */
  reply?: NativeChatCommandReply
  /** Claimed so a typed alias is answered here, but never listed beside the command it names. */
  hidden?: true
}

// Best-effort, curated per-agent catalogs. The CLIs ship no machine-readable
// command list, so these track the common, stable commands each TUI documents.
// The composer treats commands as plain data, so this can grow freely.

const COMMON_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'clear', description: 'Clear the conversation' },
  { name: 'help', description: 'Show available commands' }
]

// Pi 1.3.0's BUILTIN_SLASH_COMMANDS in its own wording (the build gentle-pi 4.3.0 installs);
// get_commands reports extensions/skills, not these TUI actions.
const PI_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'settings', description: 'Open settings menu' },
  { name: 'model', description: 'Select model (opens selector UI)' },
  { name: 'tree', description: 'Navigate session tree (switch branches)' },
  { name: 'thinking', description: 'Set thinking level', hidden: true },
  { name: 'scoped-models', description: 'Enable/disable models for Ctrl+P cycling' },
  {
    name: 'export',
    description: 'Export session (HTML default, or specify path: .html/.jsonl)'
  },
  { name: 'import', description: 'Import and resume a session from a JSONL file' },
  { name: 'share', description: 'Share session via a Radius artifact or a GitHub gist' },
  { name: 'bug', description: 'Report a bug to the Pi developers' },
  { name: 'copy', description: 'Copy last agent message to clipboard' },
  { name: 'name', description: 'Set session display name' },
  { name: 'session', description: 'Show session info and stats' },
  { name: 'changelog', description: 'Show changelog entries' },
  { name: 'hotkeys', description: 'Show all keyboard shortcuts' },
  { name: 'fork', description: 'Create a new fork from a previous user message' },
  { name: 'clone', description: 'Duplicate the current session at the current position' },
  { name: 'trust', description: 'Save project trust decision for future sessions' },
  { name: 'login', description: 'Configure provider authentication' },
  { name: 'logout', description: 'Remove provider authentication' },
  { name: 'new', description: 'Start a new session', hidden: true },
  { name: 'compact', description: 'Manually compact the session context' },
  { name: 'resume', description: 'Resume a different session' },
  {
    name: 'reload',
    description: 'Reload keybindings, extensions, skills, prompts, themes, and context files'
  },
  { name: 'quit', description: 'Quit pi' }
]

const CLAUDE_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Summarize and compact the conversation' },
  { name: 'init', description: 'Initialize a CLAUDE.md' },
  { name: 'review', description: 'Review the current changes' },
  { name: 'help', description: 'Show available commands' }
]

// Why: OpenClaude writes its `/context` report to the transcript; Claude's TUI does not.
const OPENCLAUDE_COMMANDS: readonly SlashCommandSuggestion[] = [
  ...CLAUDE_COMMANDS,
  { name: 'context', description: 'Show context usage', reply: 'transcript' }
]

// OMP built-in registry; interactive commands still execute in its terminal.
const OMP_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'model', description: 'Open the model selector in Terminal' },
  {
    name: 'switch',
    description: 'Open the temporary model selector in Terminal'
  },
  { name: 'plan', description: 'Toggle plan mode' },
  { name: 'compact', description: 'Compact conversation context' },
  { name: 'clear', description: 'Clear context while keeping the session' },
  { name: 'new', description: 'Start a new session' },
  { name: 'resume', description: 'Resume a session; without arguments, choose in Terminal' },
  { name: 'fork', description: 'Fork from a previous message in Terminal' },
  { name: 'branch', description: 'Rewind to a previous message in Terminal' },
  { name: 'tree', description: 'Browse the session tree in Terminal' },
  { name: 'session', description: 'Show session information and controls' },
  { name: 'rename', description: 'Rename the session' },
  // Why: OMP paints this in its TUI and records nothing the chat could show.
  { name: 'context', description: 'Show estimated context usage', reply: 'composer' },
  { name: 'usage', description: 'Show provider usage and limits' },
  { name: 'fast', description: 'Toggle priority service tier' },
  { name: 'tools', description: 'Show tools visible to the agent' },
  { name: 'jobs', description: 'Show background jobs' },
  { name: 'git', description: 'Open the Git viewer in Terminal' },
  { name: 'export', description: 'Export the session to HTML' },
  { name: 'settings', description: 'Open settings in Terminal' },
  { name: 'extensions', description: 'Open the extension dashboard in Terminal' },
  { name: 'hotkeys', description: 'Show keyboard shortcuts in Terminal' }
]

const COMMANDS_BY_AGENT: Partial<Record<AgentType, readonly SlashCommandSuggestion[]>> = {
  pi: PI_COMMANDS,
  claude: CLAUDE_COMMANDS,
  openclaude: OPENCLAUDE_COMMANDS,
  codex: CODEX_COMMANDS,
  omp: OMP_COMMANDS
}

/** Known slash commands for an agent, falling back to a small common set so the
 *  `/` menu is never empty for a recognized agent. */
/** Pi names two commands Orca already offers under other names: `/thinking` sets the effort and
 *  `/new` starts a fresh context, as the shared `/effort` and `/clear` do. */
const HOST_COMMAND_ALIASES: Partial<Record<AgentType, ReadonlyMap<string, string>>> = {
  codex: new Map([['new', 'clear']]),
  pi: new Map([
    ['thinking', 'effort'],
    ['new', 'clear']
  ])
}

/** The shared command a host alias answers with, or undefined for any other name. */
export function hostCommandAlias(agent: AgentType | undefined, name: string): string | undefined {
  return agent ? HOST_COMMAND_ALIASES[agent]?.get(name) : undefined
}

export function getAgentSlashCommands(agent: AgentType): readonly SlashCommandSuggestion[] {
  return COMMANDS_BY_AGENT[agent] ?? COMMON_COMMANDS
}

/** The command rows for a session that reports its own `/` surface. The report
 *  is the authority on WHICH commands exist and, when it carries one, on how a
 *  command is described; the curated catalog above only covers the names whose
 *  report is text-free. Skills are excluded — they render in the picker's own
 *  skills group. */
export function sessionSlashCommandSuggestions(
  agent: AgentType,
  reported: readonly AgentSessionSlashCommand[]
): readonly SlashCommandSuggestion[] {
  const described = new Map(
    getAgentSlashCommands(agent).map((command) => [command.name, command.description])
  )
  return reported
    .filter((entry) => entry.kind === 'command')
    .map((entry) => {
      const description = entry.description ?? described.get(entry.name)
      return {
        name: entry.name,
        ...(description ? { description } : {}),
        ...(entry.argumentHint ? { argumentHint: entry.argumentHint } : {}),
        ...(entry.kindUnspecified ? { kindUnspecified: true as const } : {})
      }
    })
}

/** Names the session reported as skills, in the order it reported them. */
export function sessionReportedSkillNames(
  reported: readonly AgentSessionSlashCommand[]
): readonly string[] {
  return reported.filter((entry) => entry.kind === 'skill').map((entry) => entry.name)
}

/** Whether the draft is a slash command (leading `/`, ignoring leading space).
 *  Slash drafts dispatch to the agent's own TUI and must NOT render an optimistic
 *  user bubble — they are control actions, not chat turns. */
export function isSlashCommandDraft(draft: string): boolean {
  return draft.trimStart().startsWith('/')
}

/** Case-insensitive prefix filter over an agent's commands. An empty query
 *  returns all commands so a bare `/` shows the full menu. */
export function filterSlashCommands(
  commands: readonly SlashCommandSuggestion[],
  query: string
): SlashCommandSuggestion[] {
  const normalized = query.toLowerCase()
  if (normalized === '') {
    return [...commands]
  }
  return commands.filter((command) => command.name.toLowerCase().startsWith(normalized))
}

/** Replace the slash token with the chosen command plus a trailing space, so the
 *  user can type arguments. This is the Tab-completion path. */
export function applySlashSuggestion(command: SlashCommandSuggestion): string {
  return `/${command.name} `
}

/** Text to send when Enter accepts a slash command from the menu — no trailing
 *  space, because the TUI dispatches the command on Enter. */
export function slashCommandDispatchText(command: SlashCommandSuggestion): string {
  return `/${command.name}`
}

export type NativeChatSendClassification = 'chat' | 'command' | 'unknown-token'

export function classifyNativeChatSend(
  draft: string,
  commands: readonly SlashCommandSuggestion[],
  pickerSkillOriginToken: string | null,
  skillPrefix: '/' | '$' | null
): NativeChatSendClassification {
  // Why: the supported TUIs only treat a line-leading token as a command, so a
  // draft with leading whitespace is prose; trimming here would claim a "Ran"
  // line for text the agent never dispatched.
  const firstToken = draft.split(/\s/, 1)[0] ?? ''
  if (pickerSkillOriginToken && firstToken === pickerSkillOriginToken) {
    return 'chat'
  }
  if (commands.some((command) => firstToken === `/${command.name}`)) {
    return 'command'
  }
  if (firstToken.startsWith('/')) {
    return 'unknown-token'
  }
  // Why: `$` is Codex grammar only. For other agents a leading `$PATH`-style
  // token is ordinary prose and must keep its bubble and attachments.
  if (skillPrefix === '$' && firstToken.startsWith('$')) {
    return 'unknown-token'
  }
  return 'chat'
}
