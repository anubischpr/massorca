import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const FOLDER_WORKSPACE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['folder-workspace', 'list'],
    summary: 'List folder workspaces on this MassOrca host',
    usage: 'orca folder-workspace list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Folder workspaces are plain folders MassOrca tracks; they are not git worktrees.'],
    examples: ['orca folder-workspace list']
  },
  {
    path: ['folder-workspace', 'create'],
    summary: 'Add a folder workspace to a project group',
    usage:
      'orca folder-workspace create --group <project group id> [--name <name>] [--path <folder>] [--connection <ssh id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'group', 'name', 'path', 'connection'],
    notes: [
      'A folder workspace tracks a plain folder, not a git worktree. --connection names the SSH connection that owns the folder; leave it out for a folder on the host itself.'
    ],
    examples: ['orca folder-workspace create --group <id> --name Docs --path ~/Docs']
  },
  {
    path: ['folder-workspace', 'update'],
    summary: 'Rename, move, archive, pin or comment on a folder workspace',
    usage:
      'orca folder-workspace update --workspace <id> [--name <name>] [--path <folder>] [--comment <text>] [--archived true|false] [--pinned true|false] [--unread true|false] [--workspace-status <status>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'workspace',
      'name',
      'path',
      'comment',
      'archived',
      'pinned',
      'unread',
      'workspace-status'
    ],
    notes: ['Only the fields you pass change. Passing none exits 1.'],
    examples: ['orca folder-workspace update --workspace <id> --archived true']
  },
  {
    path: ['folder-workspace', 'rm'],
    destructive: true,
    summary: 'Stop tracking a folder workspace',
    usage: 'orca folder-workspace rm --workspace <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'workspace'],
    notes: ['Exits 1 when no such folder workspace exists.']
  },
  {
    path: ['folder-workspace', 'path-status'],
    summary: 'Check that a folder workspace, project group or path still exists as a folder',
    usage:
      'orca folder-workspace path-status (--workspace <id> | --group <project group id> | --path <folder> [--connection <ssh id>]) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'workspace', 'group', 'path', 'connection'],
    notes: [
      'Prints the folder path and `exists`, or the reason it does not: missing, not-directory, unavailable or ambiguous-connection.'
    ],
    examples: ['orca folder-workspace path-status --workspace <id>']
  }
]
