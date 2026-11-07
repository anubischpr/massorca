import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const PROTOTYPES_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['prototypes', 'list'],
    summary: 'List prototype sets on this MassOrca host',
    usage: 'orca prototypes list [--worktree <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree'],
    notes: [
      'Prints each set title, request id, chat id, agent, and whether it is archived. --worktree limits the list to one worktree.'
    ],
    examples: ['orca prototypes list', 'orca prototypes list --worktree <id>']
  }
]
