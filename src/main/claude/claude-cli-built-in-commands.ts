/** A built-in Claude Code command, with the description the CLI gives it. */
export type ClaudeBuiltInCommand = { name: string; description: string }

/**
 * The built-in commands Claude Code 2.1.296 runs when a session receives them as text: its
 * non-interactive filter keeps prompt commands and local commands that support non-interactive use.
 * Interactive-only (`local-jsx`) commands are absent, since the CLI runs them only in its TUI.
 * Left out: commands the chat host owns (clear, compact, model, effort), session controls (exit, stop),
 * renamed or removed commands, server-only handoffs, and commands that grant account access or import
 * another agent's config. Aliases (cost, settings, name, peers) are the same commands under another name.
 */
export const CLAUDE_BUILT_IN_COMMANDS: readonly ClaudeBuiltInCommand[] = [
  { name: 'add-dir', description: 'Add a new working directory' },
  { name: 'advisor', description: 'Let Claude consult a stronger model at key moments' },
  {
    name: 'auto-mode-setup',
    description: 'Teach auto mode about your environment, plus optional rule tweaks'
  },
  { name: 'autocompact', description: 'Configure the auto-compact window size' },
  { name: 'color', description: 'Set the prompt bar color for this session' },
  { name: 'config', description: 'Set a setting by key' },
  { name: 'context', description: 'Show current context usage' },
  { name: 'focus', description: 'Toggle focus view: just your prompt, summary, and response' },
  { name: 'goal', description: 'Set a goal — keep working until the condition is met' },
  { name: 'init', description: 'Initialize a new CLAUDE.md file with codebase documentation' },
  { name: 'insights', description: 'Generate a report analyzing your Claude Code sessions' },
  {
    name: 'list-agents',
    description: 'List subagents, teammates, and other Claude sessions you can message'
  },
  { name: 'mcp', description: 'Manage MCP servers' },
  { name: 'output-style', description: 'List output styles or switch to one' },
  { name: 'recap', description: 'Generate a one-line session recap now' },
  {
    name: 'reload-plugins',
    description: 'Activate pending plugin changes in the current session'
  },
  {
    name: 'reload-skills',
    description: 'Pick up skills added or changed on disk during this session'
  },
  { name: 'rename', description: 'Rename the current conversation' },
  {
    name: 'security-review',
    description: 'Complete a security review of the pending changes on the current branch'
  },
  { name: 'skill-doctor', description: 'Show which loaded skills are unused and costing context' },
  {
    name: 'team-onboarding',
    description: 'Help teammates ramp on Claude Code with a guide from your usage'
  },
  {
    name: 'usage',
    description: "Show session cost, plan usage, and what's contributing to your limits"
  },
  {
    name: 'usage-credits',
    description: 'Configure usage credits or request them from your admin when you hit a limit'
  }
]
