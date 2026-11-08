import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const THEME_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['theme', 'get'],
    summary: 'Show the MassOrca app theme: light, dark or system',
    usage: 'orca theme get [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['orca theme get', 'orca theme get --json']
  },
  {
    path: ['theme', 'set'],
    summary: 'Set the MassOrca app theme, the same value Settings > Appearance changes',
    usage: 'orca theme set <light|dark|system> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'theme'],
    positionalArgs: ['theme'],
    notes: ['system follows the operating system appearance.'],
    examples: ['orca theme set dark', 'orca theme set system']
  }
]
