import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  GitInstallProgress,
  GitInstallRunResult,
  GitInstallStatus
} from '../../../shared/marketplace-install'
import { linuxFamily } from './git-install-plan'
import { compareVersions, meetsGitMinimum, parseGitVersion } from './git-install-probe'
import { createGitInstallService } from './git-install-service'
import { createInstallsStore, emptyInstallsRecord } from './git-install-store'
import { sanitizeLogLine } from './git-install-steps'
import type {
  GitInstallEnv,
  InstallStep,
  InstallsRecord,
  QueryResult,
  StepRunResult
} from './git-install-types'

const GIT_PATH = '/usr/bin/git'
const UBUNTU = 'NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\n'
const FEDORA = 'ID=fedora\n'

type Machine = {
  platform: NodeJS.Platform
  isRoot: boolean
  osRelease: string | null
  /** Commands that exist here: winget, brew, sudo. */
  tools: Set<string>
  /** What `git --version` reports now; null when Git is absent. */
  gitVersion: string | null
  /** What Git reports after a successful install step; null leaves it absent. */
  gitAfterInstall: string | null
  gitBroken: boolean
  gitTimesOut: boolean
  queries: Record<string, QueryResult>
  stepCodes: Record<string, number>
  stepLines: Record<string, string[]>
  stepThrows: Set<string>
  gate?: Promise<void>
  runs: string[][]
  queriesRun: string[]
}

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    platform: 'linux',
    isRoot: false,
    osRelease: UBUNTU,
    tools: new Set(['sudo', 'winget', 'brew']),
    gitVersion: null,
    gitAfterInstall: '2.43.0',
    gitBroken: false,
    gitTimesOut: false,
    queries: {},
    stepCodes: {},
    stepLines: {},
    stepThrows: new Set(),
    runs: [],
    queriesRun: [],
    ...overrides
  }
}

function makeEnv(m: Machine): { env: GitInstallEnv; readRecord: () => InstallsRecord } {
  let record: InstallsRecord = emptyInstallsRecord()
  const env: GitInstallEnv = {
    platform: m.platform,
    isRoot: m.isRoot,
    readOsRelease: () => m.osRelease,
    findCommand: async (command) => {
      if (command === 'git') {
        if (m.gitTimesOut) {
          return { status: 'timeout', binary: GIT_PATH }
        }
        if (m.gitBroken && m.gitVersion !== null) {
          return { status: 'exec_failed', binary: GIT_PATH }
        }
        return m.gitVersion === null
          ? { status: 'absent' }
          : { status: 'available', binary: GIT_PATH }
      }
      return m.tools.has(command)
        ? { status: 'available', binary: `/fake/bin/${command}` }
        : { status: 'absent' }
    },
    commandOnPath: async (command) => m.tools.has(command),
    readVersion: async () => {
      if (m.gitVersion === null) {
        throw new Error('not installed')
      }
      return `git version ${m.gitVersion}\n`
    },
    runQuery: async (program, args) => {
      const key = [program, ...args].join(' ')
      m.queriesRun.push(key)
      return m.queries[key] ?? { code: 1, stdout: '' }
    },
    runStep: async (step: InstallStep, onLine: (line: string) => void): Promise<StepRunResult> => {
      m.runs.push([...step.argv])
      if (m.gate) {
        await m.gate
      }
      if (m.stepThrows.has(step.id)) {
        throw new Error('spawn failed')
      }
      // Why sanitise here: the real runner does it before any line reaches the service.
      for (const line of m.stepLines[step.id] ?? []) {
        const clean = sanitizeLogLine(line)
        if (clean !== null) {
          onLine(clean)
        }
      }
      const code = m.stepCodes[step.id] ?? 0
      if (code === 0 && step.id === 'install') {
        m.gitVersion = m.gitAfterInstall
      }
      return { code, timedOut: false }
    },
    store: {
      read: () => record,
      write: (next) => {
        record = next
      }
    },
    now: () => new Date('2026-11-03T10:00:00.000Z')
  }
  return { env, readRecord: () => record }
}

function runWith(m: Machine) {
  const { env, readRecord } = makeEnv(m)
  const service = createGitInstallService(env)
  const events: GitInstallProgress[] = []
  const sink = (event: GitInstallProgress): void => {
    events.push(event)
  }
  return { service, events, sink, readRecord }
}

function expectMissingPlan(status: GitInstallStatus) {
  if (status.state !== 'missing') {
    throw new Error(`expected missing, got ${status.state}`)
  }
  return status.plan
}

describe('git install plans per platform', () => {
  it('uses winget with the exact command on Windows', async () => {
    const { service } = runWith(machine({ platform: 'win32', osRelease: null }))
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBe('winget')
    expect(plan.command).toBe('winget install --id Git.Git -e --source winget')
    expect(plan.manualCommand).toBe('winget install --id Git.Git -e --source winget')
    expect(plan.steps.map((step) => [step.id, step.elevation])).toEqual([
      ['install', 'os-prompt'],
      ['verify', 'none']
    ])
  })

  it('runs winget through its resolved binary, never a shell', async () => {
    const m = machine({ platform: 'win32', osRelease: null, gitAfterInstall: '2.45.1' })
    const { service, sink } = runWith(m)
    const result = await service.install(sink)
    expect(result.ok).toBe(true)
    expect(m.runs).toEqual([
      [
        '/fake/bin/winget',
        'install',
        '--id',
        'Git.Git',
        '-e',
        '--source',
        'winget',
        '--accept-source-agreements',
        '--accept-package-agreements'
      ]
    ])
  })

  it('offers only the command when winget is missing on Windows', async () => {
    const m = machine({ platform: 'win32', osRelease: null, tools: new Set() })
    const { service, sink, readRecord } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBeNull()
    expect(plan.manualCommand).toBe('winget install --id Git.Git -e --source winget')
    const result = await service.install(sink)
    expect(result).toMatchObject({ ok: false, reason: 'unsupported' })
    expect(m.runs).toEqual([])
    expect(readRecord().pending.git).toBeUndefined()
  })

  it('uses Homebrew on macOS when brew exists, with no elevation', async () => {
    const m = machine({ platform: 'darwin', osRelease: null, gitAfterInstall: '2.45.0' })
    const { service, sink } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBe('homebrew')
    expect(plan.steps[0]).toMatchObject({ id: 'install', elevation: 'none' })
    const result = await service.install(sink)
    expect(result.ok).toBe(true)
    expect(m.runs).toEqual([['/fake/bin/brew', 'install', 'git']])
  })

  it('opens the Command Line Tools installer on macOS without brew', async () => {
    const m = machine({
      platform: 'darwin',
      osRelease: null,
      tools: new Set(),
      gitAfterInstall: null
    })
    const { service, sink, readRecord } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBe('xcode-clt')
    expect(plan.command).toBe('xcode-select --install')
    const result = await service.install(sink)
    // Why installer-opened: the command returns before Apple's window finishes.
    expect(result).toMatchObject({ ok: false, reason: 'installer-opened' })
    expect(m.runs).toEqual([['xcode-select', '--install']])
    expect(readRecord().pending.git).toBeUndefined()
  })

  it('uses apt for Debian and Ubuntu, checking sudo without a password first', async () => {
    const m = machine({ gitAfterInstall: '2.43.0' })
    const { service, sink } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBe('apt')
    expect(plan.manualCommand).toBe('sudo apt-get install -y git')
    expect(plan.steps.map((step) => step.id)).toEqual(['admin-check', 'install', 'verify'])
    const result = await service.install(sink)
    expect(result.ok).toBe(true)
    expect(m.runs).toEqual([
      ['sudo', '-n', 'true'],
      ['sudo', '-n', 'apt-get', 'install', '-y', 'git']
    ])
  })

  it('runs apt without sudo when already root', async () => {
    const m = machine({ isRoot: true, gitAfterInstall: '2.43.0' })
    const { service, sink } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manualCommand).toBe('apt-get install -y git')
    expect(plan.steps.map((step) => step.id)).toEqual(['install', 'verify'])
    await service.install(sink)
    expect(m.runs).toEqual([['apt-get', 'install', '-y', 'git']])
  })

  it('uses dnf on Fedora', async () => {
    const m = machine({ osRelease: FEDORA, gitAfterInstall: '2.45.2' })
    const { service, sink } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBe('dnf')
    expect(plan.manualCommand).toBe('sudo dnf install -y git')
    await service.install(sink)
    expect(m.runs[1]).toEqual(['sudo', '-n', 'dnf', 'install', '-y', 'git'])
  })

  it('gives no command on an unknown Linux distribution', async () => {
    const m = machine({ osRelease: 'ID=arch\n' })
    const { service, sink } = runWith(m)
    const plan = expectMissingPlan(await service.status())
    expect(plan.manager).toBeNull()
    expect(plan.manualCommand).toBeNull()
    expect(await service.install(sink)).toMatchObject({ ok: false, reason: 'unsupported' })
  })
})

describe('git install run', () => {
  it('streams step progress, sanitised log lines, then verifies and records the install', async () => {
    const m = machine({
      isRoot: true,
      gitAfterInstall: '2.43.0',
      stepLines: { install: ['Reading package lists...', '\r  -  ', 'Setting up git'] }
    })
    const { service, events, sink, readRecord } = runWith(m)
    const result = await service.install(sink)
    expect(result.ok).toBe(true)
    expect(events).toEqual([
      { stepId: 'install', status: 'running' },
      { stepId: 'install', status: 'running', logLine: 'Reading package lists...' },
      { stepId: 'install', status: 'running', logLine: 'Setting up git' },
      { stepId: 'install', status: 'done' },
      { stepId: 'verify', status: 'running' },
      { stepId: 'verify', status: 'done' }
    ])
    expect(readRecord().tools.git).toEqual({
      manager: 'apt',
      recordedAt: '2026-11-03T10:00:00.000Z'
    })
    if (result.ok) {
      expect(result.status).toEqual({
        state: 'installed',
        version: '2.43.0',
        path: GIT_PATH,
        installedBy: 'massorca'
      })
    }
  })

  it('asks for a manual command when sudo needs a password and runs no install', async () => {
    const m = machine({ stepCodes: { 'admin-check': 1 } })
    const { service, events, sink, readRecord } = runWith(m)
    const result = await service.install(sink)
    expect(result).toMatchObject({
      ok: false,
      reason: 'needs-password',
      manualCommand: 'sudo apt-get install -y git'
    })
    expect(m.runs).toEqual([['sudo', '-n', 'true']])
    expect(events).toContainEqual({ stepId: 'admin-check', status: 'failed' })
    expect(readRecord().pending.git?.manager).toBe('apt')
  })

  it('reports a verification failure with the manual command and keeps the offer pending', async () => {
    const m = machine({ isRoot: true, gitAfterInstall: null })
    const { service, events, sink, readRecord } = runWith(m)
    const result = await service.install(sink)
    expect(result).toMatchObject({
      ok: false,
      reason: 'verify-failed',
      manualCommand: 'apt-get install -y git',
      status: { state: 'missing' }
    })
    expect(events.at(-1)).toEqual({ stepId: 'verify', status: 'failed' })
    expect(readRecord().pending.git?.manager).toBe('apt')
  })

  it('rejects an installed Git below the 2.25 minimum', async () => {
    const m = machine({ isRoot: true, gitAfterInstall: '2.24.0' })
    const { service, sink } = runWith(m)
    const result = await service.install(sink)
    expect(result).toMatchObject({ ok: false, reason: 'too-old', status: { state: 'too-old' } })
  })

  it('reports a step that throws as a failed step, not a crash', async () => {
    const m = machine({ isRoot: true, stepThrows: new Set(['install']) })
    const { service, events, sink } = runWith(m)
    const result = await service.install(sink)
    expect(result).toMatchObject({ ok: false, reason: 'step-failed' })
    expect(events).toContainEqual({ stepId: 'install', status: 'failed' })
  })

  it('refuses a second install while one is running', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const m = machine({ isRoot: true, gitAfterInstall: '2.43.0', gate })
    const { service, sink } = runWith(m)
    const first = service.install(sink)
    const second: GitInstallRunResult = await service.install(sink)
    expect(second).toMatchObject({ ok: false, reason: 'busy' })
    release()
    expect((await first).ok).toBe(true)
  })

  it('records a manual install as MassOrca’s once the same manager owns Git', async () => {
    const m = machine({ isRoot: true, gitAfterInstall: null })
    const { service, sink, readRecord } = runWith(m)
    await service.install(sink)
    expect(readRecord().pending.git?.manager).toBe('apt')

    // The person runs the manual command; Git now appears and dpkg confirms apt owns it.
    m.gitVersion = '2.43.0'
    m.queries[`dpkg -S ${GIT_PATH}`] = { code: 0, stdout: 'git: /usr/bin/git\n' }
    const status = await service.status()
    expect(status).toEqual({
      state: 'installed',
      version: '2.43.0',
      path: GIT_PATH,
      installedBy: 'massorca'
    })
    expect(readRecord().tools.git?.manager).toBe('apt')
    expect(readRecord().pending.git).toBeUndefined()
  })
})

describe('git install status and ownership', () => {
  it('finds Git owned by apt outside MassOrca and adopts it without reinstalling', async () => {
    const m = machine({ gitVersion: '2.43.0' })
    m.queries[`dpkg -S ${GIT_PATH}`] = { code: 0, stdout: 'git: /usr/bin/git\n' }
    const { service, sink, readRecord } = runWith(m)
    expect(await service.status()).toMatchObject({ state: 'outside', owner: 'apt' })
    const result = await service.adopt(sink)
    expect(result).toEqual({
      ok: true,
      status: { state: 'installed', version: '2.43.0', path: GIT_PATH, installedBy: 'massorca' }
    })
    expect(m.runs).toEqual([])
    expect(readRecord().tools.git?.manager).toBe('apt')
  })

  it('finds Git owned by winget on Windows', async () => {
    const m = machine({ platform: 'win32', osRelease: null, gitVersion: '2.45.1' })
    m.queries['/fake/bin/winget list --id Git.Git -e'] = {
      code: 0,
      stdout: 'Git  Git.Git  2.45.1\n'
    }
    const { service } = runWith(m)
    expect(await service.status()).toMatchObject({ state: 'outside', owner: 'winget' })
  })

  it('reinstalls over Git whose owner is unknown when asked to manage it', async () => {
    const m = machine({ isRoot: true, gitVersion: '2.43.0', gitAfterInstall: '2.45.0' })
    const { service, sink } = runWith(m)
    expect(await service.status()).toMatchObject({ state: 'outside', owner: 'unknown' })
    const result = await service.adopt(sink)
    expect(result.ok).toBe(true)
    expect(m.runs).toEqual([['apt-get', 'install', '-y', 'git']])
  })

  it('reports a binary that exists but does not run as broken', async () => {
    const m = machine({ gitVersion: '2.43.0', gitBroken: true })
    const { service } = runWith(m)
    expect(await service.status()).toMatchObject({
      state: 'broken',
      path: GIT_PATH,
      owner: 'unknown'
    })
  })

  it('reports an unverifiable probe as unverifiable, never as missing', async () => {
    const m = machine({ gitTimesOut: true })
    const { service } = runWith(m)
    expect(await service.status()).toEqual({ state: 'unverifiable', reason: 'probe-timeout' })
  })

  it('reports Git below the minimum as too old', async () => {
    const m = machine({ gitVersion: '2.20.0' })
    const { service } = runWith(m)
    expect(await service.status()).toMatchObject({ state: 'too-old', version: '2.20.0' })
  })
})

describe('git version parsing', () => {
  it('reads Windows and plain version strings', () => {
    expect(parseGitVersion('git version 2.45.1.windows.1\n')).toBe('2.45.1')
    expect(parseGitVersion('git version 2.25')).toBe('2.25.0')
    expect(parseGitVersion('not git')).toBeNull()
  })

  it('compares against the 2.25 minimum numerically', () => {
    expect(meetsGitMinimum('2.25.0')).toBe(true)
    expect(meetsGitMinimum('2.24.9')).toBe(false)
    expect(meetsGitMinimum('2.100.0')).toBe(true)
    expect(compareVersions('2.9.0', '2.10.0')).toBeLessThan(0)
  })
})

describe('linux family and log lines', () => {
  it('maps Debian, Ubuntu and their derivatives, and Fedora and RHEL', () => {
    expect(linuxFamily(UBUNTU)).toBe('debian')
    expect(linuxFamily('ID=linuxmint\nID_LIKE="ubuntu debian"\n')).toBe('debian')
    expect(linuxFamily(FEDORA)).toBe('fedora')
    expect(linuxFamily('ID="rhel"\nID_LIKE="fedora"\n')).toBe('fedora')
    expect(linuxFamily('ID=arch\n')).toBeNull()
    expect(linuxFamily(null)).toBeNull()
  })

  it('strips escapes and spinner frames, drops blank lines and truncates long ones', () => {
    const escape = String.fromCharCode(27)
    expect(sanitizeLogLine(`${escape}[32mDone${escape}[0m`)).toBe('Done')
    expect(sanitizeLogLine('  -  \r  \\  \r  Downloading 40%  ')).toBe('Downloading 40%')
    expect(sanitizeLogLine('   ')).toBeNull()
    expect(sanitizeLogLine('|/-\\')).toBeNull()
    const long = sanitizeLogLine('x'.repeat(400))
    expect(long?.length).toBe(240)
    expect(long?.endsWith('…')).toBe(true)
  })
})

describe('install state file', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'git-install-store-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips a record and reads a corrupt file as empty', () => {
    const file = join(dir, 'marketplace', 'installs.json')
    const store = createInstallsStore(file)
    expect(store.read()).toEqual(emptyInstallsRecord())
    store.write({
      version: 1,
      tools: { git: { manager: 'dnf', recordedAt: '2026-11-03T10:00:00.000Z' } },
      pending: {}
    })
    expect(store.read().tools.git?.manager).toBe('dnf')
    writeFileSync(file, '{ not json', 'utf8')
    expect(store.read()).toEqual(emptyInstallsRecord())
  })
})
