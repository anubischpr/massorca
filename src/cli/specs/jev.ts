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
  },
  {
    path: ['jev', 'enable'],
    summary: 'Turn Jev decisions on for this MassOrca host',
    usage: 'orca jev enable [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Needs a stored API key (see `orca jev set-key`). Turning it on spends that key.']
  },
  {
    path: ['jev', 'disable'],
    summary: 'Turn Jev decisions off for this MassOrca host',
    usage: 'orca jev disable [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['jev', 'set-key'],
    summary: 'Store the Jev API key on this MassOrca host',
    usage: 'orca jev set-key (--key-stdin | --key-env <NAME>) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key', 'key-stdin', 'key-env'],
    notes: [
      'The key comes only from stdin (--key-stdin) or a named env var (--key-env); --key on the command line is refused, and no output prints the key.'
    ],
    examples: [
      'printf %s "$JEV_API_KEY" | orca jev set-key --key-stdin',
      'orca jev set-key --key-env JEV_API_KEY'
    ]
  },
  {
    path: ['jev', 'clear-key'],
    destructive: true,
    summary: 'Remove the stored Jev API key and turn Jev decisions off',
    usage: 'orca jev clear-key [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  }
]
