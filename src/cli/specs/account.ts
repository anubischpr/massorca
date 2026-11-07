import { GLOBAL_FLAGS, type CommandSpec } from '../args'

// Why: the desktop "Add account" button is disabled when the UI drives a remote
// runtime (a headless server). These commands run the interactive agent login
// (`claude login` / `codex login`) in the caller's own terminal on the host and
// register the captured account with the local runtime, giving headless hosts a
// way to manage Claude and Codex accounts.
export const ACCOUNT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['account', 'add'],
    summary: 'Add a managed agent account by signing in on this MassOrca host',
    usage:
      'orca account add [--agent claude|codex|opencode|devin|antigravity] [--label <name>] [--integration <id>] [--target host|wsl:<distro>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'label', 'integration', 'target'],
    notes: [
      'Runs the agent login (`claude login` / `codex login`) in this terminal, then registers the account with the local MassOrca runtime.',
      'Codex uses device authorization so the browser can complete sign-in from a different machine.',
      'OpenCode 2 uses `opencode auth login --standalone` in private XDG directories. Devin uses `devin auth login --force-manual-token-flow`.',
      'Use --integration <id> to skip the OpenCode integration picker; --label names the saved OpenCode or Devin profile.',
      'OpenCode and Devin profiles apply to new explicit host agent launches. Direct SSH relay and Windows-hosted WSL selection are not supported; run the command on a headless MassOrca runtime on that host.',
      'Sign in with the account you want to add (e.g. use a private/incognito browser window for a second account).',
      '--agent defaults to claude. Requires the MassOrca runtime to be running on this machine.',
      '--agent antigravity saves the Antigravity account that is signed in on this host right now; it opens no login.'
    ],
    examples: ['orca account add', 'orca account add --agent codex']
  },
  {
    path: ['account', 'list'],
    summary: 'List managed agent accounts on this MassOrca host',
    usage:
      'orca account list [--agent opencode|devin|antigravity] [--target host|wsl:<distro>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'target'],
    notes: [
      'Lists the accounts on this machine. `--environment` / `--pairing-code` are rejected rather than ignored; run it on the host whose accounts you want to see.'
    ],
    examples: ['orca account list']
  },
  {
    path: ['account', 'select'],
    summary: 'Select the managed account that new agent launches use',
    usage:
      'orca account select --agent claude|codex|opencode|devin|antigravity --account <id|system> [--target host|wsl:<distro>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'account', 'target'],
    notes: [
      '`system` goes back to the default login (not for Antigravity). --target picks the host or one WSL distro slot for Codex and Antigravity; Codex without it selects for every slot.'
    ],
    examples: ['orca account select --agent claude --account <id>']
  },
  {
    path: ['account', 'rm'],
    aliases: [['account', 'remove']],
    destructive: true,
    summary: 'Remove a managed agent account and its private data',
    usage:
      'orca account rm --agent claude|codex|opencode|devin|antigravity --account <id> [--target host|wsl:<distro>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'agent', 'account', 'target'],
    notes: [
      'Deletes credentials and conversation data in the managed profile. Stop its running agents first. System credentials are never removed.'
    ]
  },
  {
    path: ['account', 'codex-reset-credit'],
    destructive: true,
    summary: 'Spend one earned Codex rate-limit reset credit on the selected account',
    usage: 'orca account codex-reset-credit --account <id> [--target host|wsl:<distro>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'account', 'target'],
    notes: [
      'Spends a finite credit, so it refuses unless the host reports one on offer for this account, which must be the selected Codex account for the target.',
      'It reads fresh usage first and sends the offer the host just reported, so a stale offer is rejected rather than spent.'
    ]
  }
]
