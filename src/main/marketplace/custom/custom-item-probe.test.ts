import { describe, expect, it, vi } from 'vitest'
import type { LocalCommandProbe } from '../../ipc/preflight-command-exec'
import {
  detectCustomItemPresence,
  resolveInstallArgv,
  type CheckRun,
  type CustomItemProbeEnv
} from './custom-item-probe'

const available: LocalCommandProbe = { status: 'available', binary: 'C:/tools/mytool.exe' }

function probeEnv(
  probe: LocalCommandProbe,
  run: () => Promise<CheckRun> = async () => ({ code: 0, timedOut: false })
) {
  return {
    findCommand: vi.fn(async (_command: string) => probe),
    runCheck: vi.fn(async (_program: string, _args: readonly string[]) => run())
  }
}

function errorWithCode(code: string): Error {
  return Object.assign(new Error(`spawn ${code}`), { code })
}

describe('detectCustomItemPresence', () => {
  it('reports found when the check command exits 0, run on the resolved binary', async () => {
    const env = probeEnv(available)
    await expect(detectCustomItemPresence(env, ['mytool', '--version'])).resolves.toBe('found')
    expect(env.findCommand).toHaveBeenCalledWith('mytool')
    expect(env.runCheck).toHaveBeenCalledWith('C:/tools/mytool.exe', ['--version'])
  })

  it('reports missing, without running anything, when the program is absent', async () => {
    const env = probeEnv({ status: 'absent' })
    await expect(detectCustomItemPresence(env, ['mytool', '--version'])).resolves.toBe('missing')
    expect(env.runCheck).not.toHaveBeenCalled()
  })

  it('reports missing when the check cannot start the program', async () => {
    const env = probeEnv(available, async () => {
      throw errorWithCode('ENOENT')
    })
    await expect(detectCustomItemPresence(env, ['mytool'])).resolves.toBe('missing')
  })

  it('reports unverifiable when the check fails for another reason', async () => {
    const env = probeEnv(available, async () => {
      throw errorWithCode('EACCES')
    })
    await expect(detectCustomItemPresence(env, ['mytool'])).resolves.toBe('unverifiable')
  })

  it('reports unverifiable for a non-zero exit', async () => {
    const env = probeEnv(available, async () => ({ code: 2, timedOut: false }))
    await expect(detectCustomItemPresence(env, ['mytool', 'status'])).resolves.toBe('unverifiable')
  })

  it('reports unverifiable when the check times out', async () => {
    const env = probeEnv(available, async () => ({ code: null, timedOut: true }))
    await expect(detectCustomItemPresence(env, ['mytool'])).resolves.toBe('unverifiable')
  })

  it.each<LocalCommandProbe>([
    { status: 'exec_failed', binary: 'C:/tools/mytool.exe' },
    { status: 'timeout', binary: 'C:/tools/mytool.exe' },
    { status: 'limit_reached', binary: 'C:/tools/mytool.exe' }
  ])('reports unverifiable, and runs nothing, when the probe ends %j', async (probe) => {
    const env = probeEnv(probe)
    await expect(detectCustomItemPresence(env, ['mytool'])).resolves.toBe('unverifiable')
    expect(env.runCheck).not.toHaveBeenCalled()
  })

  it('reports unverifiable when the probe itself throws', async () => {
    const env: CustomItemProbeEnv = {
      findCommand: async () => {
        throw new Error('listing failed')
      },
      runCheck: async () => ({ code: 0, timedOut: false })
    }
    await expect(detectCustomItemPresence(env, ['mytool'])).resolves.toBe('unverifiable')
  })

  it('reports unverifiable, and probes nothing, for a skill with no check command', async () => {
    const env = probeEnv(available)
    await expect(detectCustomItemPresence(env, null)).resolves.toBe('unverifiable')
    expect(env.findCommand).not.toHaveBeenCalled()
  })
})

describe('resolveInstallArgv', () => {
  it('runs a bare program by the binary the probe resolved', async () => {
    const env = probeEnv({ status: 'available', binary: 'C:/Windows/winget.exe' })
    await expect(resolveInstallArgv(env, ['winget', 'install', 'mytool'])).resolves.toEqual([
      'C:/Windows/winget.exe',
      'install',
      'mytool'
    ])
  })

  it('runs a path the person typed as typed, without probing it', async () => {
    const env = probeEnv(available)
    await expect(resolveInstallArgv(env, ['C:\\Tools\\setup.exe', '/quiet'])).resolves.toEqual([
      'C:\\Tools\\setup.exe',
      '/quiet'
    ])
    expect(env.findCommand).not.toHaveBeenCalled()
  })

  it('refuses a bare program that cannot be found or run', async () => {
    await expect(
      resolveInstallArgv(probeEnv({ status: 'absent' }), ['winget', 'install'])
    ).resolves.toBeNull()
    await expect(
      resolveInstallArgv(probeEnv({ status: 'exec_failed', binary: 'winget' }), [
        'winget',
        'install'
      ])
    ).resolves.toBeNull()
  })
})
