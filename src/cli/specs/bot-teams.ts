import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: each command is one host RPC; room posts and hand-offs run on the host as they do in the app.
export const BOT_TEAMS_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['bot-teams', 'list'],
    summary: 'List Bot teams on this MassOrca host',
    usage: 'orca bot-teams list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Prints each team id, name, and bot count. Pass the id to --team in the other bot-teams commands.'
    ],
    examples: ['orca bot-teams list']
  },
  {
    path: ['bot-teams', 'room'],
    summary: 'Show a Bot team room: task and message counts and its latest tasks',
    usage: 'orca bot-teams room --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team'],
    notes: [
      'Each task shows its last final status: Done, Stopped, or Stuck. Not started means it waits in Todo; Unknown means no final status yet.',
      '--json prints the full room data, including every task and message.'
    ],
    examples: ['orca bot-teams room --team <id>', 'orca bot-teams room --team <id> --json']
  },
  {
    path: ['bot-teams', 'routines'],
    summary: "List a Bot team's scheduled routines",
    usage: 'orca bot-teams routines --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team'],
    notes: ['Prints each routine name, its schedule, and whether it is paused.'],
    examples: ['orca bot-teams routines --team <id>']
  },
  {
    path: ['bot-teams', 'messages'],
    summary: "List a Bot team room's messages, with authors and attached files",
    usage: 'orca bot-teams messages --team <id> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'limit'],
    notes: [
      'Each line is the message id, its author (you or a bot name), and its first line. --limit keeps the last n messages.'
    ],
    examples: [
      'orca bot-teams messages --team <id>',
      'orca bot-teams messages --team <id> --limit 20'
    ]
  },
  {
    path: ['bot-teams', 'tasks'],
    summary: "List a Bot team room's tasks with their status and owner",
    usage: 'orca bot-teams tasks --team <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team'],
    examples: ['orca bot-teams tasks --team <id>']
  },
  {
    path: ['bot-teams', 'task', 'show'],
    summary: 'Show one task: status, owner, project, and the final text its bot wrote',
    usage: 'orca bot-teams task show --team <id> --task <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'task'],
    notes: [
      'Result is the newest text the bot wrote in the task session; none yet until the bot has written a final answer.'
    ],
    examples: ['orca bot-teams task show --team <id> --task <id>']
  },
  {
    path: ['bot-teams', 'send'],
    summary:
      'Post a message to a Bot team room, with an optional reply quote and team-folder files',
    usage:
      'orca bot-teams send --team <id> (--text <message> | --text-stdin) [--reply-to <message-id>] [--attach <attachments/file,...>] [--no-start] [--prototypes <1-4>] [--design-system use|propose|skip] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'team',
      'text',
      'text-stdin',
      'reply-to',
      'attach',
      'no-start',
      'prototypes',
      'design-system'
    ],
    notes: [
      'The room files the message like the app does: a bot takes it, or it asks a question first. A question prints the answer command.',
      '--attach names files already in the team folder attachments/ folder; the CLI does not copy files in.',
      '--no-start saves the task to Todo. --prototypes and --design-system answer the prototype card.'
    ],
    examples: [
      'orca bot-teams send --team <id> --text "Draft the release notes"',
      'printf %s "$NOTE" | orca bot-teams send --team <id> --text-stdin --reply-to <message-id>'
    ]
  },
  {
    path: ['bot-teams', 'answer'],
    summary: "Answer a Bot team room's question about one of your requests",
    usage:
      'orca bot-teams answer --team <id> --request <message-id> [--bot <name|id>] [--team-to <name|id>] [--project <name|id|none>] [--later] [--prototypes <1-4>] [--design-system use|propose|skip] [--attach <attachments/file,...>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'team',
      'request',
      'bot',
      'team-to',
      'project',
      'later',
      'prototypes',
      'design-system',
      'attach'
    ],
    notes: [
      '--request is the id of your message, as `bot-teams messages` lists it. Its text and files are filed again with your answer.',
      'Give at most one of --bot, --team-to and --project; --later saves the task to Todo. With none, the room chooses.'
    ],
    examples: [
      'orca bot-teams answer --team <id> --request <message-id> --bot Pepe',
      'orca bot-teams answer --team <id> --request <message-id> --project Launch --later'
    ]
  },
  {
    path: ['bot-teams', 'delegate'],
    summary: 'Hand work to a named bot on a Bot team, and with --wait read its result',
    usage:
      'orca bot-teams delegate --team <id> --bot <name|id> (--text <task> | --text-stdin) [--wait] [--timeout <seconds>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'bot', 'text', 'text-stdin', 'wait', 'timeout'],
    notes: [
      'The bot starts the task at once. Without --wait the command returns with the task id; read the result later with `bot-teams task show`.',
      '--wait polls the room until the task finishes, then prints the bot final text. It exits 1 on timeout, a stuck or stopped task, or a question for you.',
      'A bot name that matches two bots is refused; pass its id. --timeout defaults to 600 seconds.'
    ],
    examples: [
      'orca bot-teams delegate --team <id> --bot Estrellita --text "Draft the notes" --wait',
      'orca bot-teams delegate --team <id> --bot <bot-id> --text "Check the build" --wait --timeout 120'
    ]
  }
]
