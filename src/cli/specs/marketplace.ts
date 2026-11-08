import { GLOBAL_FLAGS, type CommandSpec } from '../args'
import { SKILL_INSTALL_PROVIDERS } from '../../shared/skill-install-providers'

const TOKEN_FLAGS = ['token', 'token-stdin', 'token-env']

const SKILL_HOST_USAGE = '--host local|wsl:<distro>|ssh:<target-id>|runtime:<environment-id>'
const SKILL_HOST_NOTE =
  '--host picks the machine, as the desktop host picker does: local is this computer, wsl:<distro> a WSL distro on it, ssh:<target-id> an SSH host, runtime:<environment-id> a paired MassOrca server.'
const SKILL_AGENT_IDS = SKILL_INSTALL_PROVIDERS.map((provider) => provider.id).join(', ')

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
  },
  {
    path: ['marketplace', 'audit'],
    summary: 'Show which Marketplace pages open or are blocked on a host, and why',
    usage: `orca marketplace audit [${SKILL_HOST_USAGE}] [--strict] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'strict'],
    runtimeHostIsTarget: true,
    notes: [
      SKILL_HOST_NOTE,
      'Here --host runtime:<environment-id> keeps the connection on this computer’s app and asks it about that server, as when the server is picked in its host picker. To have a paired server audit itself, select it with --environment and leave --host out.',
      'The host’s desktop window computes each row with the same code the Marketplace page uses: whether its page opens, the block code and reason when it does not, the controls the page shows, and whether it is native or needs an outside tool.',
      'A headless host with no desktop window open answers that it cannot audit.',
      '--strict exits 1 when any page is blocked.'
    ],
    examples: ['orca marketplace audit', 'orca marketplace audit --host wsl:Ubuntu --strict --json']
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
    summary: 'Connect a service on this host with a token from stdin or an env var',
    usage:
      'orca marketplace services connect <gitlab|bitbucket|azure-devops|gitea|linear|jira> (--token-stdin | --token-env <NAME>) [--site <url>] [--email <address>] [--auth-type cloud|server] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'service', 'site', 'email', 'auth-type', ...TOKEN_FLAGS],
    positionalArgs: ['service'],
    notes: [
      'Linear takes an API key. Jira needs --site, plus --email for Jira Cloud.',
      'GitLab, Bitbucket, Azure DevOps and Gitea store the token in the host’s Marketplace vault; --site sets a self-hosted server URL and --email is for Bitbucket.',
      'A host that predates those methods gets the old route: `glab auth login` for GitLab, Marketplace › Services in the desktop app for the rest.'
    ],
    examples: [
      'orca marketplace services connect gitea --site https://git.example.com --token-env GITEA_TOKEN',
      'orca marketplace services connect linear --token-env LINEAR_API_KEY',
      'printf %s "$JIRA_TOKEN" | orca marketplace services connect jira --site https://acme.atlassian.net --email me@acme.com --token-stdin'
    ]
  },
  {
    path: ['marketplace', 'services', 'disconnect'],
    destructive: true,
    summary: 'Disconnect a service on this host',
    usage:
      'orca marketplace services disconnect <bitbucket|azure-devops|gitea|linear|jira> [--json]',
    notes: ['GitLab accounts belong to glab; sign out with `glab auth logout` on the host.'],
    allowedFlags: [...GLOBAL_FLAGS, 'service'],
    positionalArgs: ['service']
  },
  {
    path: ['marketplace', 'skills', 'list'],
    summary: 'List Marketplace skills installed on a host and the agents that read them',
    usage: `orca marketplace skills list [${SKILL_HOST_USAGE}] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host'],
    notes: [
      SKILL_HOST_NOTE,
      'Without --host, lists every global install on the connected host, with WSL distros and SSH hosts tagged.'
    ],
    examples: [
      'orca marketplace skills list',
      'orca marketplace skills list --host wsl:Ubuntu --json'
    ]
  },
  {
    path: ['marketplace', 'skills', 'show'],
    summary: "Show one skill's package, agents and the folders that hold it on a host",
    usage: `orca marketplace skills show <name> [${SKILL_HOST_USAGE}] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'name'],
    positionalArgs: ['name'],
    notes: [
      SKILL_HOST_NOTE,
      'Prints each folder and SKILL.md path on the host so an agent there can open and read it. SSH hosts have no folder listing yet, so only the package record shows.'
    ],
    examples: ['orca marketplace skills show caveman --json']
  },
  {
    path: ['marketplace', 'skills', 'install'],
    summary: 'Install a catalog skill or a package file on a host, for chosen agents',
    usage: `orca marketplace skills install (--package <id> --version <id> | --file <package.tar.gz>) [--agents <id,id>|none] [--conflict replace-unmodified|replace-and-discard-local|cancel] [${SKILL_HOST_USAGE}] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'file', 'package', 'version', 'agents', 'conflict'],
    notes: [
      SKILL_HOST_NOTE,
      '--package with --version installs that catalog version; the desktop app on the connected host gets the cloud download grant, so SSH hosts work too. A headless host without the desktop’s sign-in answers that Skill Cloud is unavailable.',
      'A package file is read on this computer and sent to the host, so it works for a paired host too; the host checks its digest before placing anything. SSH hosts take only catalog installs.',
      `--agents picks the agents that read the skill (${SKILL_AGENT_IDS}); leave it out for every detected agent, or pass none for the shared agents folder only.`,
      'Exits 1 when the host reports anything other than installed, updated or unchanged.'
    ],
    examples: [
      'orca marketplace skills install --package pkg_123 --version ver_456 --agents claude,codex',
      'orca marketplace skills install --file ./caveman.tar.gz --agents claude,codex',
      'orca marketplace skills install --file ./caveman.tar.gz --host wsl:Ubuntu --json'
    ]
  },
  {
    path: ['marketplace', 'skills', 'agents'],
    summary: 'Turn agents on or off for an installed skill and show the copies left on the host',
    usage: `orca marketplace skills agents <name> --agents <id,id>|none [--file <package.tar.gz>] [--conflict replace-unmodified|replace-and-discard-local|cancel] [${SKILL_HOST_USAGE}] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'name', 'agents', 'file', 'conflict'],
    positionalArgs: ['name'],
    notes: [
      SKILL_HOST_NOTE,
      `--agents is the full list of agents that should read the skill (${SKILL_AGENT_IDS}); an agent left out loses its copy on that host.`,
      'Reinstalls the installed catalog version with the new list, as the desktop agent switches do. On a host without the desktop’s Skill Cloud sign-in, pass --file with the same package and version instead.',
      'Prints the placements the host changed and the folders that remain; exits 1 when the host did not record the new list.'
    ],
    examples: ['orca marketplace skills agents caveman --agents codex']
  },
  {
    path: ['marketplace', 'skills', 'uninstall'],
    destructive: true,
    summary: 'Remove a Marketplace skill installed globally on a host',
    usage: `orca marketplace skills uninstall <name> [--conflict replace-and-discard-local|cancel] [${SKILL_HOST_USAGE}] [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'name', 'conflict'],
    positionalArgs: ['name'],
    notes: [
      SKILL_HOST_NOTE,
      'Without --host the skill is removed from the connected host, as before.',
      'Exits 1 unless the host reports the skill removed; a locally edited copy is reported as a conflict until --conflict says what to do.'
    ]
  }
]
