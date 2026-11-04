import type { GitInstallPlanView } from '../../../shared/marketplace-install'
import type { GitInstallEnv, InstallStep, InternalPlan } from './git-install-types'

const WINGET_COMMAND = 'winget install --id Git.Git -e --source winget'
const BREW_COMMAND = 'brew install git'
const XCODE_COMMAND = 'xcode-select --install'
const APT_COMMAND = 'apt-get install -y git'
const DNF_COMMAND = 'dnf install -y git'

const UNSUPPORTED: InternalPlan = { manager: null, command: null, manualCommand: null, steps: [] }

/** Per platform, the one install MassOrca runs; `manualCommand` is what the failure board offers to copy. */
export async function planGitInstall(env: GitInstallEnv): Promise<InternalPlan> {
  if (env.platform === 'win32') {
    return planWindows(env)
  }
  if (env.platform === 'darwin') {
    return planMacOs(env)
  }
  if (env.platform === 'linux') {
    return planLinux(env)
  }
  return UNSUPPORTED
}

async function planWindows(env: GitInstallEnv): Promise<InternalPlan> {
  const winget = await env.findCommand('winget')
  if (winget.status !== 'available') {
    // Why still offer the command: the person may have winget under a path MassOrca cannot see.
    return { manager: null, command: null, manualCommand: WINGET_COMMAND, steps: [] }
  }
  return {
    manager: 'winget',
    command: WINGET_COMMAND,
    manualCommand: WINGET_COMMAND,
    steps: [
      {
        id: 'install',
        label: 'Install Git with winget',
        // Why the resolved binary: Windows resolves a bare name before PATH (AGENTS.md, Windows child processes).
        // Why the agreement flags: stdin is closed, so winget's first-run prompts would hang the step.
        argv: [
          winget.binary,
          'install',
          '--id',
          'Git.Git',
          '-e',
          '--source',
          'winget',
          '--accept-source-agreements',
          '--accept-package-agreements'
        ],
        elevation: 'os-prompt',
        failure: 'step-failed'
      }
    ]
  }
}

async function planMacOs(env: GitInstallEnv): Promise<InternalPlan> {
  const brew = await env.findCommand('brew')
  if (brew.status === 'available') {
    return {
      manager: 'homebrew',
      command: BREW_COMMAND,
      manualCommand: BREW_COMMAND,
      steps: [
        {
          id: 'install',
          label: 'Install Git with Homebrew',
          argv: [brew.binary, 'install', 'git'],
          elevation: 'none',
          failure: 'step-failed'
        }
      ]
    }
  }
  // Why no brew: xcode-select only opens Apple's installer window, so the run finishes before Git exists.
  return {
    manager: 'xcode-clt',
    command: XCODE_COMMAND,
    manualCommand: XCODE_COMMAND,
    steps: [
      {
        id: 'install',
        label: 'Open the Command Line Tools installer',
        argv: ['xcode-select', '--install'],
        elevation: 'os-prompt',
        failure: 'step-failed'
      }
    ]
  }
}

async function planLinux(env: GitInstallEnv): Promise<InternalPlan> {
  const family = linuxFamily(env.readOsRelease())
  if (family === null) {
    return UNSUPPORTED
  }
  const packageCommand = family === 'debian' ? APT_COMMAND : DNF_COMMAND
  const manager = family === 'debian' ? 'apt' : 'dnf'
  const manualCommand = env.isRoot ? packageCommand : `sudo ${packageCommand}`
  // Why sudo -n: MassOrca never asks for a password; a password prompt becomes the manual command.
  const sudo = env.isRoot ? [] : ['sudo', '-n']
  const check: InstallStep[] = env.isRoot
    ? []
    : [
        {
          id: 'admin-check',
          label: 'Check administrator access without a password',
          argv: ['sudo', '-n', 'true'],
          elevation: 'sudo',
          failure: 'needs-password'
        }
      ]
  const installArgv = packageCommand.split(' ')
  return {
    manager,
    command: manualCommand,
    manualCommand,
    steps: [
      ...check,
      {
        id: 'install',
        label: `Install Git with ${manager}`,
        argv: [...sudo, ...installArgv],
        elevation: env.isRoot ? 'none' : 'sudo',
        failure: 'step-failed'
      }
    ]
  }
}

/** Debian and Fedora families only; anything else gets the plain instruction, never a guessed command. */
export function linuxFamily(osRelease: string | null): 'debian' | 'fedora' | null {
  if (osRelease === null) {
    return null
  }
  const values = new Map<string, string>()
  for (const line of osRelease.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match?.[1] && match[2] !== undefined) {
      values.set(match[1], match[2].replace(/^"|"$/g, ''))
    }
  }
  const ids = [values.get('ID') ?? '', ...(values.get('ID_LIKE') ?? '').split(' ')]
  if (ids.some((id) => id === 'debian' || id === 'ubuntu')) {
    return 'debian'
  }
  if (ids.some((id) => id === 'fedora' || id === 'rhel' || id === 'centos')) {
    return 'fedora'
  }
  return null
}

/** The view the renderer shows: the plan steps plus the final check that Git works. */
export function toPlanView(plan: InternalPlan): GitInstallPlanView {
  if (plan.manager === null) {
    return { manager: null, command: null, manualCommand: plan.manualCommand, steps: [] }
  }
  return {
    manager: plan.manager,
    command: plan.command,
    manualCommand: plan.manualCommand,
    steps: [
      ...plan.steps.map(({ id, label, elevation }) => ({ id, label, elevation })),
      { id: 'verify', label: 'Check that Git works', elevation: 'none' }
    ]
  }
}
