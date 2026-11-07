import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: these only read the host's Bot team state; posting, editing and starting tasks stay in the app.
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
  }
]
