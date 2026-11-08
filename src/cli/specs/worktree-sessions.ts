import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const WORKTREE_SESSION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['worktree', 'sessions'],
    summary: 'List agent sessions (chats and terminal agents) under a worktree',
    usage: 'orca worktree sessions --worktree <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree'],
    notes: [
      'Lists the agent rows the sidebar shows under the worktree. A terminal agent id is its terminal handle; a chat id is its chat session id.',
      'age is the time since the session entered its current state.',
      'A session with no terminal or chat behind it is listed with its pane key as id, and session-close refuses it.'
    ],
    examples: [
      'orca worktree sessions --worktree active',
      'orca worktree sessions --worktree id:<repo-id>::<path> --json'
    ]
  },
  {
    path: ['worktree', 'session-close'],
    destructive: true,
    summary: 'Close one agent session under a worktree by the id worktree sessions printed',
    usage: 'orca worktree session-close --worktree <selector> --session <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'session'],
    notes: [
      'Only a session listed under the given worktree can be closed; any other id is refused and nothing is closed.',
      'A terminal agent closes as orca terminal close does; a stop the host cannot confirm exits non-zero.',
      'A chat closes as closing its tab does: its record and journal stay on disk, so it can be attached again.'
    ],
    examples: [
      'orca worktree session-close --worktree active --session term_abc123',
      'orca worktree session-close --worktree active --session <chat-session-id> --json'
    ]
  }
]
