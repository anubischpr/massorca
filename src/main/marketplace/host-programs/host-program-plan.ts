import { linuxFamily } from '../install/git-install-plan'
import type {
  HostExecutor,
  HostPlatform,
  InstallOption,
  PlanStep,
  ProgramPlan,
  ProgramSpec,
  RunResult
} from './host-program-types'

// Why 20 minutes: winget, apt and npm downloads on a slow link can take that long; an SSH host is capped lower by its transport.
export const INSTALL_STEP_TIMEOUT_MS = 20 * 60_000
const QUERY_TIMEOUT_MS = 20_000

// Why constants: both are fixed text the host runs, and the proofs read what they print.
export const HOME_SCRIPT = 'printf %s "$HOME"'
export const LOCAL_APP_DATA_SCRIPT = '[Console]::Out.Write($env:LOCALAPPDATA)'

const PROBED_COMMANDS = ['winget', 'brew', 'npm', 'curl', 'bash', 'apt-get', 'dnf', 'sudo'] as const

/** What the host has, read once per action so a plan never guesses. */
export type HostFacts = {
  platform: HostPlatform
  has: ReadonlySet<string>
  isRoot: boolean
  family: 'debian' | 'fedora' | null
  /** The host's home folder on POSIX hosts, when it answered with an absolute path. */
  home: string | null
  /** The host's LOCALAPPDATA on Windows, when it answered with a drive path. */
  localAppData: string | null
}

export async function gatherHostFacts(exec: HostExecutor): Promise<HostFacts> {
  const posix = exec.platform !== 'win32'
  const [found, uid, osRelease, folder] = await Promise.all([
    Promise.all(
      PROBED_COMMANDS.map(async (command) => [command, await exec.which(command)] as const)
    ),
    posix ? exec.run(['id', '-u'], QUERY_TIMEOUT_MS) : Promise.resolve(null),
    exec.platform === 'linux' ? exec.run(['cat', '/etc/os-release'], QUERY_TIMEOUT_MS) : null,
    exec.script(posix ? HOME_SCRIPT : LOCAL_APP_DATA_SCRIPT, QUERY_TIMEOUT_MS)
  ])
  const folderPath = folder.code === 0 ? folder.stdout.trim() : ''
  return {
    platform: exec.platform,
    has: new Set(
      found.filter(([, result]) => result.state === 'found').map(([command]) => command)
    ),
    isRoot: uid?.code === 0 && uid.stdout.trim() === '0',
    family: osRelease?.code === 0 ? linuxFamily(osRelease.stdout) : null,
    home: posix && folderPath.startsWith('/') ? folderPath : null,
    localAppData: !posix && /^[A-Za-z]:[\\/]/.test(folderPath) ? folderPath : null
  }
}

function usable(option: InstallOption, facts: HostFacts): boolean {
  switch (option.method) {
    case 'winget':
      return facts.has.has('winget')
    case 'brew':
      return facts.has.has('brew')
    case 'npm':
      return facts.has.has('npm')
    case 'apt':
      return facts.family === 'debian' && facts.has.has('apt-get')
    case 'dnf':
      return facts.family === 'fedora' && facts.has.has('dnf')
    case 'script':
      return option.shell === 'powershell'
        ? facts.platform === 'win32'
        : facts.has.has('curl') && facts.has.has('bash')
  }
}

function word(value: string): string {
  return /^[\w@./:=+-]+$/.test(value) ? value : JSON.stringify(value)
}

function argvOf(option: InstallOption, verb: 'install' | 'uninstall'): string[] | null {
  const install = verb === 'install'
  switch (option.method) {
    case 'winget':
      return install
        ? [
            'winget',
            'install',
            '--id',
            option.id,
            '-e',
            '--source',
            'winget',
            '--silent',
            '--accept-source-agreements',
            '--accept-package-agreements'
          ]
        : ['winget', 'uninstall', '--id', option.id, '-e', '--silent', '--accept-source-agreements']
    case 'brew':
      return ['brew', verb, ...(option.cask ? ['--cask'] : []), option.name]
    case 'npm':
      return install ? ['npm', 'install', '-g', option.pkg] : ['npm', 'uninstall', '-g', option.pkg]
    case 'apt':
      return ['apt-get', install ? 'install' : 'remove', '-y', ...option.pkgs]
    case 'dnf':
      return ['dnf', install ? 'install' : 'remove', '-y', ...option.pkgs]
    case 'script':
      return null
  }
}

function packagePlan(option: InstallOption, argv: string[], facts: HostFacts): ProgramPlan {
  const sudo = (option.method === 'apt' || option.method === 'dnf') && !facts.isRoot
  // Why sudo -n: MassOrca never asks for a password; a password prompt becomes the manual command.
  const steps: PlanStep[] = sudo
    ? [
        { argv: ['sudo', '-n', 'true'], timeoutMs: QUERY_TIMEOUT_MS, adminCheck: true },
        { argv: ['sudo', '-n', ...argv], timeoutMs: INSTALL_STEP_TIMEOUT_MS }
      ]
    : [{ argv, timeoutMs: INSTALL_STEP_TIMEOUT_MS }]
  const shown = argv.map(word).join(' ')
  return { method: option.method, steps, display: sudo ? `sudo ${shown}` : shown, needsSudo: sudo }
}

/** The first install this host can run, in the vendor-preferred order; null when none fits. */
export function planInstall(spec: ProgramSpec, facts: HostFacts): ProgramPlan | null {
  for (const option of spec.options[facts.platform]) {
    if (option.installable === false || !usable(option, facts)) {
      continue
    }
    if (option.method === 'script') {
      return {
        method: 'script',
        steps: [{ script: option.text, timeoutMs: INSTALL_STEP_TIMEOUT_MS }],
        display: option.display,
        needsSudo: false
      }
    }
    const argv = argvOf(option, 'install')
    if (argv) {
      return packagePlan(option, argv, facts)
    }
  }
  return null
}

/** The removal for the option that owns the program, or the vendor's documented native removal. */
export function planRemoval(
  spec: ProgramSpec,
  owner: InstallOption | 'native',
  facts: HostFacts
): ProgramPlan | null {
  if (owner === 'native') {
    const removal = spec.nativeUninstall?.[facts.platform]
    return removal
      ? {
          method: 'script',
          steps: [{ script: removal.script, timeoutMs: QUERY_TIMEOUT_MS }],
          display: removal.display,
          needsSudo: false
        }
      : null
  }
  const argv = argvOf(owner, 'uninstall')
  return argv ? packagePlan(owner, argv, facts) : null
}

type OwnershipProbe = { argv: string[]; owned: (result: RunResult) => boolean }

/** The package-manager question that proves an option owns the installed program. */
export function ownershipProbe(option: InstallOption): OwnershipProbe | null {
  switch (option.method) {
    case 'winget':
      return {
        argv: ['winget', 'list', '--id', option.id, '-e', '--accept-source-agreements'],
        owned: (r) => r.code === 0 && r.stdout.toLowerCase().includes(option.id.toLowerCase())
      }
    case 'brew':
      return {
        argv: ['brew', 'list', option.cask ? '--cask' : '--formula', '--versions', option.name],
        owned: (r) => r.code === 0 && r.stdout.trim().length > 0
      }
    case 'npm':
      return {
        argv: ['npm', 'ls', '-g', '--depth=0', option.pkg],
        owned: (r) => r.code === 0 && r.stdout.includes(option.pkg)
      }
    case 'apt':
      return {
        argv: ['dpkg', '-s', option.pkgs[0] ?? ''],
        owned: (r) => r.code === 0 && /^Status: .* installed$/m.test(r.stdout)
      }
    case 'dnf':
      return { argv: ['rpm', '-q', option.pkgs[0] ?? ''], owned: (r) => r.code === 0 }
    case 'script':
      return null
  }
}
