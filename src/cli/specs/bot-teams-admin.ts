import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: the team, bot, memory, web address and file commands mirror the Bot teams screens one for one.
export const BOT_TEAMS_ADMIN_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['bot-teams', 'team', 'create'],
    summary: 'Create a Bot team on this MassOrca host',
    usage:
      'orca bot-teams team create --name <text> --character <name> [--purpose <text>] [--workspaces on|off] [--bots-json <json>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'name', 'character', 'purpose', 'workspaces', 'bots-json'],
    notes: [
      '--character takes the team character: square, circle, triangle, hexagon, diamond or blob.',
      '--bots-json takes an array of bots as bot add takes them; a bot needs a name and an agent.'
    ]
  },
  {
    path: ['bot-teams', 'team', 'update'],
    summary: 'Change a Bot team name, purpose, character, access or workspace option',
    usage:
      'orca bot-teams team update --team <id> [--name <text>] [--purpose <text>] [--character <name>] [--access-mode default|full-access] [--workspaces on|off] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'team',
      'name',
      'purpose',
      'character',
      'access-mode',
      'workspaces'
    ],
    notes: ['Only the fields you pass change.']
  },
  {
    path: ['bot-teams', 'team', 'rm'],
    destructive: true,
    summary: 'Delete a Bot team and its room',
    usage: 'orca bot-teams team rm --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team']
  },
  {
    path: ['bot-teams', 'bot', 'add'],
    summary: 'Add a bot to a Bot team',
    usage:
      'orca bot-teams bot add --team <id> --name <text> --agent <agent> [--job <text>] [--model-mode auto|manual] [--model <name>] [--effort <level>] [--skills <a,b>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'team',
      'name',
      'agent',
      'job',
      'model-mode',
      'model',
      'effort',
      'skills'
    ],
    notes: ['--agent takes a terminal agent id, such as claude, codex or gentle-shell.']
  },
  {
    path: ['bot-teams', 'bot', 'update'],
    summary: 'Change a bot name, job, agent, model, effort or skills',
    usage:
      'orca bot-teams bot update --team <id> --bot <name|id> [--name <text>] [--job <text>] [--agent <agent>] [--model-mode auto|manual] [--model <name|none>] [--effort <level|none>] [--skills <a,b>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'team',
      'bot',
      'name',
      'job',
      'agent',
      'model-mode',
      'model',
      'effort',
      'skills'
    ],
    notes: ['Only the fields you pass change; none clears a model or effort.']
  },
  {
    path: ['bot-teams', 'bot', 'rm'],
    destructive: true,
    summary: 'Remove a bot from a Bot team',
    usage: 'orca bot-teams bot rm --team <id> --bot <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'bot']
  },
  {
    path: ['bot-teams', 'memory', 'list'],
    summary: "List a Bot team's memory: what the team and its bots remember",
    usage: 'orca bot-teams memory list --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team'],
    notes: ['Each line starts with the memory id that `bot-teams memory rm` takes.']
  },
  {
    path: ['bot-teams', 'memory', 'rm'],
    destructive: true,
    summary: 'Forget one line of Bot team memory',
    usage: 'orca bot-teams memory rm --memory <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'memory']
  },
  {
    path: ['bot-teams', 'webhook', 'list'],
    summary: "List a Bot team's web addresses and the host endpoint that receives their calls",
    usage: 'orca bot-teams webhook list --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team']
  },
  {
    path: ['bot-teams', 'webhook', 'create'],
    summary: 'Create a web address that starts a task for a bot',
    usage: 'orca bot-teams webhook create --team <id> --bot <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'bot'],
    notes: ['The secret prints once, in this reply. The host keeps only its hash, so store it now.']
  },
  {
    path: ['bot-teams', 'webhook', 'rotate-secret'],
    summary: 'Replace the secret of a web address; the old secret stops working',
    usage: 'orca bot-teams webhook rotate-secret --webhook <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'webhook'],
    notes: ['The new secret prints once, in this reply.']
  },
  {
    path: ['bot-teams', 'file', 'versions'],
    summary: 'List the saved versions of a file in a Bot team folder',
    usage: 'orca bot-teams file versions --team <id> --path <relative-path> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'path']
  },
  {
    path: ['bot-teams', 'file', 'restore-version'],
    summary: 'Put a team folder file back as one of its saved versions',
    usage:
      'orca bot-teams file restore-version --team <id> --path <relative-path> --version <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'path', 'version'],
    notes: ['The host saves the current file first, so this can be undone.']
  }
]
