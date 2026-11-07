import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const FOLDER_WORKSPACE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['folder-workspace', 'list'],
    summary: 'List folder workspaces on this MassOrca host',
    usage: 'orca folder-workspace list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Folder workspaces are plain folders MassOrca tracks; they are not git worktrees.'],
    examples: ['orca folder-workspace list']
  }
]
