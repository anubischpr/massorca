import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const ACCOUNT_USAGE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['account', 'usage'],
    summary: 'Show session and weekly usage for each agent provider on this MassOrca host',
    usage: 'orca account usage [--refresh] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'refresh'],
    notes: [
      'Prints one line per provider that has usage data. --refresh fetches fresh usage first, which can take a while.',
      '`--environment` and `--pairing-code` are rejected rather than ignored; run it on the host whose accounts you want to see.'
    ],
    examples: ['orca account usage', 'orca account usage --refresh']
  }
]
