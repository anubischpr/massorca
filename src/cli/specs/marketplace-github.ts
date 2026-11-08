import { GLOBAL_FLAGS, type CommandSpec } from '../args'

const HOST_USAGE = '[--host local|runtime:<environment-id>]'
const HOST_NOTE =
  '--host runtime:<environment-id> runs it on that paired MassOrca server. WSL distros and SSH hosts are reachable only from the desktop app for now.'

export const MARKETPLACE_GITHUB_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['marketplace', 'github', 'accounts', 'list'],
    summary: 'List the GitHub accounts gh is signed in to on a host',
    usage: `orca marketplace github accounts list ${HOST_USAGE} [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host'],
    notes: [
      HOST_NOTE,
      'A * marks the active account. Shows where each login comes from (keyring or a GITHUB_TOKEN/GH_TOKEN env var) and its scopes; never a token.'
    ],
    examples: ['orca marketplace github accounts list --host runtime:pv-vps --json']
  },
  {
    path: ['marketplace', 'github', 'accounts', 'switch'],
    summary: 'Make a signed-in GitHub account the active one in gh on a host',
    usage: `orca marketplace github accounts switch <user> [--github-host github.com] ${HOST_USAGE} [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'user', 'github-host'],
    positionalArgs: ['user'],
    notes: [
      HOST_NOTE,
      '--github-host names a GitHub Enterprise server; the default is github.com.'
    ],
    examples: ['orca marketplace github accounts switch alice']
  },
  {
    path: ['marketplace', 'github', 'accounts', 'rm'],
    destructive: true,
    summary: 'Sign a GitHub account out of gh on a host',
    usage: `orca marketplace github accounts rm <user> [--github-host github.com] ${HOST_USAGE} --yes [--json]`,
    allowedFlags: [...GLOBAL_FLAGS, 'host', 'user', 'github-host', 'yes'],
    positionalArgs: ['user'],
    notes: [HOST_NOTE, 'Needs --yes. Exits 1 when the host could not remove it.'],
    examples: ['orca marketplace github accounts rm bob --yes']
  }
]
