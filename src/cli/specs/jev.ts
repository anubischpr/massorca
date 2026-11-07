import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const JEV_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['jev', 'status'],
    summary: 'Show whether Jev decisions are enabled and whether an API key is stored',
    usage: 'orca jev status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Shows only the enabled switch and whether a key is stored. The key itself is never printed.'
    ],
    examples: ['orca jev status']
  }
]
