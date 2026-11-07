import { GLOBAL_FLAGS, type CommandSpec } from '../args'

const TOKEN_FLAGS = ['token', 'token-stdin', 'token-env']

// Why: the Marketplace page is GUI-only otherwise; these let an agent on a headless host inspect
// and repair app entries through the same host RPC methods the page calls.
export const MARKETPLACE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['marketplace', 'list'],
    summary: "List Marketplace apps with each agent's integration status",
    usage: 'orca marketplace list [--app engram|openmetadata|github] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'app'],
    notes: [
      'Agent states: Set, Missing (Connect writes it), Not set, Built in, Not installed, Blocked by access policy, Unreadable config.',
      'Reads entry names and whether a token is stored; never a token value.',
      'Use --environment <name> to read a paired host, such as the VPS, from this computer.'
    ],
    examples: ['orca marketplace list', 'orca marketplace list --app openmetadata --json']
  },
  {
    path: ['marketplace', 'connect'],
    summary: "Connect an app, or repair agents' missing entries with stored credentials",
    usage:
      'orca marketplace connect <engram|openmetadata|github> [--server <url>] [--token-stdin | --token-env <NAME>] [--profile <name>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'app', 'server', 'profile', ...TOKEN_FLAGS],
    positionalArgs: ['app'],
    notes: [
      'With no flags, an app already set up on the host is repaired: every allowed agent gets its entry again, from the server address and token the host already stores.',
      'Tokens come only from stdin (--token-stdin) or a named env var (--token-env); --token on the command line is refused, and no output prints a token.',
      'OpenMetadata: a first connect or a new --server needs a token. --profile <name> adds an extra profile with --server and a token.',
      'Engram: --server sets the Engram cloud address; a token without --server reuses the current one.'
    ],
    examples: [
      'orca marketplace connect engram',
      'orca marketplace connect openmetadata',
      'printf %s "$OM_TOKEN" | orca marketplace connect openmetadata --server https://om.example.com --token-stdin',
      'orca marketplace connect openmetadata --profile escritura --server https://om.example.com --token-env OM_WRITE_TOKEN'
    ]
  },
  {
    path: ['marketplace', 'disconnect'],
    destructive: true,
    summary: "Disconnect an app and remove the entries MassOrca wrote in agents' configs",
    usage: 'orca marketplace disconnect <engram|openmetadata|github> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'app'],
    positionalArgs: ['app'],
    notes: [
      'Removes only entries MassOrca wrote, backing each file up first, and deletes the stored tokens for that app.'
    ]
  },
  {
    path: ['marketplace', 'access'],
    summary: 'Show or set which agents may use a Marketplace app on this host',
    usage:
      'orca marketplace access <engram|openmetadata|github> [--mode everyone|only|except] [--agents <id,id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'app', 'mode', 'agents'],
    positionalArgs: ['app'],
    notes: [
      'Without --mode, prints the selected access mode for agents and bots.',
      '--mode changes only the agent half; bot and team picks stay as they are. Agents: claude, codex, antigravity, gentle-shell.'
    ],
    examples: [
      'orca marketplace access openmetadata',
      'orca marketplace access engram --mode except --agents antigravity'
    ]
  }
]

export const MARKETPLACE_SERVICE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['marketplace', 'services', 'list'],
    summary: 'Show GitLab, Bitbucket, Azure DevOps, Gitea, Linear and Jira status on this host',
    usage: 'orca marketplace services list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Shows connected, not connected or unknown (the host predates that check), with the account name. Never a token.'
    ],
    examples: ['orca marketplace services list --json']
  },
  {
    path: ['marketplace', 'services', 'connect'],
    summary: 'Connect Linear or Jira on this host with a token from stdin or an env var',
    usage:
      'orca marketplace services connect <linear|jira> (--token-stdin | --token-env <NAME>) [--site <url>] [--email <address>] [--auth-type cloud|server] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'service', 'site', 'email', 'auth-type', ...TOKEN_FLAGS],
    positionalArgs: ['service'],
    notes: [
      'Linear takes an API key. Jira needs --site, plus --email for Jira Cloud.',
      'GitLab connects with `glab auth login` on the host. Bitbucket, Azure DevOps and Gitea have no host connect method yet; use Settings > Integrations in the desktop app.'
    ],
    examples: [
      'orca marketplace services connect linear --token-env LINEAR_API_KEY',
      'printf %s "$JIRA_TOKEN" | orca marketplace services connect jira --site https://acme.atlassian.net --email me@acme.com --token-stdin'
    ]
  },
  {
    path: ['marketplace', 'services', 'disconnect'],
    destructive: true,
    summary: 'Disconnect Linear or Jira on this host',
    usage: 'orca marketplace services disconnect <linear|jira> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'service'],
    positionalArgs: ['service']
  },
  {
    path: ['marketplace', 'skills', 'list'],
    summary: 'List Marketplace skills installed on this host and the agents that read them',
    usage: 'orca marketplace skills list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Lists global installs; WSL distros on this host are tagged.'],
    examples: ['orca marketplace skills list']
  },
  {
    path: ['marketplace', 'skills', 'uninstall'],
    destructive: true,
    summary: 'Remove a Marketplace skill installed globally on this host',
    usage: 'orca marketplace skills uninstall <name> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'name'],
    positionalArgs: ['name'],
    notes: [
      'Installing a skill needs a download grant from the signed-in desktop app; use the Marketplace skill page for that.'
    ]
  }
]
