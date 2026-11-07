import { GLOBAL_FLAGS, type CommandSpec } from '../args'

const REQUEST_FLAGS = ['session', 'request']

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
  },
  {
    path: ['prototypes', 'create'],
    summary: 'Make a prototype request folder for a chat, as the Prototypes page does',
    usage:
      'orca prototypes create --session <chat id> --agent claude|codex|antigravity|gentle-shell|other --prompt <text> --count <1-4> [--worktree <id>] [--chat-title <text>] [--design-system use|propose|skip] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'session',
      'agent',
      'prompt',
      'count',
      'worktree',
      'chat-title',
      'design-system'
    ],
    notes: [
      'Prints the new request id and its folder on the host. The chat must be local to the host; otherwise it exits 1 with `unsupported`.',
      '--session is the chat (session) id that owns the request; find it in `orca prototypes list`.'
    ],
    examples: [
      'orca prototypes create --session <chat id> --agent claude --prompt "A pricing page" --count 3'
    ]
  },
  {
    path: ['prototypes', 'archive'],
    summary: 'Archive one prototype request',
    usage: 'orca prototypes archive --session <chat id> --request <request id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS],
    examples: ['orca prototypes archive --session <chat id> --request <request id>']
  },
  {
    path: ['prototypes', 'unarchive'],
    summary: 'Bring an archived prototype request back',
    usage: 'orca prototypes unarchive --session <chat id> --request <request id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS]
  },
  {
    path: ['prototypes', 'rm'],
    destructive: true,
    summary: 'Delete one prototype request folder whose chat or worktree is gone',
    usage: 'orca prototypes rm --session <chat id> --request <request id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS],
    notes: [
      'The host refuses with `not_deletable` while the chat and its worktree both still exist. Check `deletable` in `orca prototypes list --json`.'
    ]
  },
  {
    path: ['prototypes', 'restore-version'],
    summary: 'Copy an earlier version of one direction into its next version',
    usage:
      'orca prototypes restore-version --session <chat id> --request <request id> --letter <A-Z> --version <n> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS, 'letter', 'version'],
    notes: ['Nothing is overwritten or removed; the restored copy becomes the newest version.']
  },
  {
    path: ['prototypes', 'write-attachment'],
    summary: 'Save a note screenshot (PNG) into a prototype request',
    usage:
      'orca prototypes write-attachment --session <chat id> --request <request id> --name <base name> --image <png path> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS, 'name', 'image'],
    notes: [
      '--name is a plain base name (letters, digits, - and _). --image is read on this computer and sent to the host; the limit is about 1.5 MB.'
    ]
  },
  {
    path: ['prototypes', 'read-file'],
    summary: 'Print the html of one file of a prototype request',
    usage:
      'orca prototypes read-file --session <chat id> --request <request id> --file <file name> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, ...REQUEST_FLAGS, 'file'],
    examples: [
      'orca prototypes read-file --session <chat id> --request <request id> --file A-v1.html'
    ]
  },
  {
    path: ['prototypes', 'design-system', 'read'],
    summary: "Show the design system files of a chat's project",
    usage: 'orca prototypes design-system read --session <chat id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session'],
    notes: ['Prints the file names; --json carries tokens.json, components.html and system.md.']
  },
  {
    path: ['prototypes', 'design-system', 'versions'],
    summary: "List the saved versions of a chat's design system",
    usage: 'orca prototypes design-system versions --session <chat id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session']
  },
  {
    path: ['prototypes', 'design-system', 'version'],
    summary: 'Read one saved version of a design system',
    usage: 'orca prototypes design-system version --session <chat id> --version <n> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session', 'version']
  },
  {
    path: ['prototypes', 'design-system', 'restore'],
    summary: 'Make an earlier design system version the current one',
    usage: 'orca prototypes design-system restore --session <chat id> --version <n> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session', 'version'],
    notes: [
      'The current version is kept first; saved versions are never deleted. Exits 1 with `current` when that version is already current.'
    ]
  }
]
