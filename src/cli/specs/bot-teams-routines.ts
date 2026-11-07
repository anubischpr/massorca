import { GLOBAL_FLAGS, type CommandSpec } from '../args'

const SCHEDULE_FLAGS = ['time', 'frequency', 'weekday', 'month-day', 'date', 'zone']

// Why: a routine runs on the host that owns its team; these commands edit the same routines the screen does.
export const BOT_TEAMS_ROUTINE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['bot-teams', 'routine', 'create'],
    summary: 'Create a scheduled routine that starts a task for a bot',
    usage:
      'orca bot-teams routine create --team <id> --bot <name|id> --name <text> --prompt <text> --time <HH:MM> [--frequency daily|weekly|monthly|once] [--weekday <0-6>] [--month-day <1-31>] [--date <YYYY-MM-DD>] [--zone <IANA zone>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'bot', 'name', 'prompt', ...SCHEDULE_FLAGS],
    notes: [
      '--frequency defaults to daily. Weekly needs --weekday (0 is Sunday), monthly needs --month-day, once needs --date.',
      '--zone defaults to this computer zone.'
    ],
    examples: [
      'orca bot-teams routine create --team <id> --bot Estrellita --name "Morning digest" --prompt "Summarize the room" --time 09:00 --zone Europe/Madrid'
    ]
  },
  {
    path: ['bot-teams', 'routine', 'update'],
    summary: 'Change a routine name, prompt, bot or schedule',
    usage:
      'orca bot-teams routine update --team <id> --routine <name|id> [--bot <name|id>] [--name <text>] [--prompt <text>] [--time <HH:MM>] [--frequency daily|weekly|monthly|once] [--weekday <0-6>] [--month-day <1-31>] [--date <YYYY-MM-DD>] [--zone <IANA zone>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'routine', 'bot', 'name', 'prompt', ...SCHEDULE_FLAGS],
    notes: ['Only the fields you pass change; the rest keep the routine values.']
  },
  {
    path: ['bot-teams', 'routine', 'rm'],
    destructive: true,
    summary: 'Delete a scheduled routine',
    usage: 'orca bot-teams routine rm --team <id> --routine <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'routine']
  },
  {
    path: ['bot-teams', 'routine', 'pause'],
    summary: 'Pause a routine so it stops starting tasks',
    usage: 'orca bot-teams routine pause --team <id> --routine <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'routine']
  },
  {
    path: ['bot-teams', 'routine', 'resume'],
    summary: 'Resume a paused routine',
    usage: 'orca bot-teams routine resume --team <id> --routine <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'routine']
  },
  {
    path: ['bot-teams', 'routine', 'runs'],
    summary: "List a routine's runs, with the task each started or why it failed",
    usage: 'orca bot-teams routine runs --team <id> --routine <name|id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'team', 'routine']
  }
]
