// The `/` menus each agent's own TUI shows, captured verbatim in the preview HOME (agy 1.4.3 and
// Codex 0.162.1). Kept apart from native-chat-slash-commands.ts, which is at its line limit.
import type { SlashCommandSuggestion } from './native-chat-slash-commands'

// Codex's `/init` and `/recap`: the app-server takes them as literal text. Unverified: the TUI's own
// prompts are not reproduced, so the model receives the command name only.
export const CODEX_TEXT_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'init', description: 'create an AGENTS.md file with instructions for Codex' },
  { name: 'recap', description: 'summarize the current conversation now' }
]

// agy 1.4.3's TUI "/" menu, captured in the preview HOME with verbatim wording. Prompt and skill
// commands expand from text, so they are listed; TUI-only entries (settings, panels, login, purchase)
// are left out. Skills on disk and plugin skills come from skill discovery, not from this list. None
// has been run over stream-json. agy-customizations takes its full description from its SKILL.md;
// antigravity-guide keeps the captured text, which the capture cut at 140 characters.
export const ANTIGRAVITY_CLI_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'model', description: 'Set a model, or run a single prompt on another model' },
  { name: 'effort', description: 'Set the reasoning effort' },
  {
    name: 'agy-customizations',
    description:
      'Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.'
  },
  {
    name: 'antigravity-guide',
    description:
      'Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity…'
  },
  { name: 'boost', description: 'Invoke the Boost multi-agent orchestrator for complex tasks.' },
  { name: 'browser', description: 'Invoke a browser agent for web tasks.' },
  { name: 'btw', description: 'Ask a side question without interrupting the current task' },
  { name: 'goal', description: 'Run until the specified goal is completely finished.' },
  { name: 'grill-me', description: 'Interview me to align on a plan.' },
  {
    name: 'learn',
    description: 'Reflect on recent successes or corrections to capture reusable skills or rules.'
  },
  { name: 'plan', description: 'Plan carefully before executing a task.' },
  {
    name: 'schedule',
    description: 'Run an instruction on a recurring schedule or as a one-time timer.'
  },
  {
    name: 'teamwork',
    description: 'Invoke a team of agents to autonomously tackle large projects.'
  }
]

// Codex 0.162.1's TUI "/" menu, captured in the preview HOME with verbatim wording. Visible rows
// are host-owned or app-server requests this app already sends. Hidden rows stay claimed, so typing
// them is refused rather than sent to the model as prose: TUI-only entries, excluded ones (delete,
// logout, archive, exit, fast, import), and entries not yet mapped to an Orca surface. Codex `/new`
// starts a fresh context, as `/clear` does.
export const CODEX_COMMANDS: readonly SlashCommandSuggestion[] = [
  { name: 'agents', description: 'open the agent command center', hidden: true },
  { name: 'approve', description: 'approve one retry of a recent auto-review denial' },
  { name: 'archive', description: 'archive this session', hidden: true },
  { name: 'cd', description: 'change the current working directory', hidden: true },
  { name: 'clear', description: 'clear the terminal and start a new chat' },
  { name: 'compact', description: 'summarize conversation to prevent hitting the context limit' },
  { name: 'copy', description: 'copy the last response or part of it', hidden: true },
  { name: 'daemon', description: 'Manage the local background server', hidden: true },
  { name: 'delete', description: 'permanently delete this session', hidden: true },
  { name: 'diff', description: 'show git diff (including untracked files)', hidden: true },
  { name: 'exit', description: 'exit Codex', hidden: true },
  { name: 'experimental', description: 'toggle experimental features', hidden: true },
  { name: 'export', description: 'export the conversation as markdown', hidden: true },
  { name: 'fast', description: '2x speed, increased usage', hidden: true },
  { name: 'feedback', description: 'send logs to maintainers', hidden: true },
  { name: 'fork', description: 'fork the current chat' },
  { name: 'goal', description: 'set or view the goal for a long-running task' },
  { name: 'hooks', description: 'view and manage lifecycle hooks', hidden: true },
  {
    name: 'ide',
    description: 'include current selection, open files, and other context from your IDE',
    hidden: true
  },
  {
    name: 'import',
    description: 'import setup, this project, and recent chats from Claude Code',
    hidden: true
  },
  {
    name: 'init',
    description: 'create an AGENTS.md file with instructions for Codex',
    hidden: true
  },
  { name: 'keymap', description: 'remap TUI shortcuts', hidden: true },
  { name: 'logout', description: 'log out of Codex', hidden: true },
  {
    name: 'mcp',
    description: 'list MCP tools; use /mcp verbose or /mcp login <name>',
    hidden: true
  },
  { name: 'memories', description: 'configure memory use and generation' },
  { name: 'mention', description: 'mention a file', hidden: true },
  { name: 'model', description: 'choose what model and reasoning effort to use' },
  { name: 'new', description: 'start a new chat during a conversation', hidden: true },
  { name: 'permissions', description: 'choose what Codex is allowed to do', hidden: true },
  { name: 'pets', description: 'choose or hide the terminal pet', hidden: true },
  { name: 'plan', description: 'switch to Plan mode', hidden: true },
  { name: 'plugins', description: 'browse plugins' },
  { name: 'ps', description: 'list background terminals', hidden: true },
  { name: 'pwd', description: 'show the current working directory', hidden: true },
  {
    name: 'raw',
    description: 'toggle raw scrollback mode for copy-friendly terminal selection',
    hidden: true
  },
  { name: 'recap', description: 'summarize the current conversation now', hidden: true },
  { name: 'rename', description: 'rename the current thread' },
  { name: 'resume', description: 'resume a saved chat', hidden: true },
  { name: 'review', description: 'review my current changes and find issues' },
  { name: 'side', description: 'start a side conversation in an ephemeral fork', hidden: true },
  { name: 'skills', description: 'use skills to improve how Codex performs specific tasks' },
  {
    name: 'status',
    description: 'show current session configuration and token usage',
    hidden: true
  },
  {
    name: 'statusline',
    description: 'configure which items appear in the status line',
    hidden: true
  },
  { name: 'stop', description: 'stop all background terminals' },
  { name: 'subagents', description: "switch between this session's subagents", hidden: true },
  { name: 'theme', description: 'choose a syntax highlighting theme', hidden: true },
  {
    name: 'title',
    description: 'configure which items appear in the terminal title',
    hidden: true
  },
  { name: 'tui', description: 'choose the TUI mode for the next launch', hidden: true },
  { name: 'usage', description: 'view account usage or use a usage limit reset', hidden: true },
  { name: 'vim', description: 'toggle Vim mode for the composer', hidden: true },
  {
    name: 'voice',
    description: 'start or stop voice; use /voice settings to choose a voice',
    hidden: true
  },
  { name: 'warnings', description: 'view retained warnings and diagnostic details', hidden: true },
  {
    name: 'worktree',
    description: 'start or continue a conversation in a new worktree',
    hidden: true
  },
  { name: 'app', description: 'Continue in Codex Desktop', hidden: true },
  { name: 'personality', description: 'Choose a communication style', hidden: true },
  { name: 'agent', description: 'Switch the active agent thread', hidden: true }
]
