import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSshHostExecutor } from './host-program-ssh-executor'

const mocks = vi.hoisted(() => ({
  runProcess: vi.fn(),
  runWslProcess: vi.fn(),
  resolve: vi.fn()
}))

vi.mock('../../../shared/child-process/run-process', () => ({ runProcess: mocks.runProcess }))
vi.mock('../../wsl/wsl-runner', () => ({ runWslProcess: mocks.runWslProcess }))
vi.mock('../../ipc/command-path-resolver', () => ({ resolveCommandOnLocalPath: mocks.resolve }))
vi.mock('../../ipc/preflight-local-env', () => ({ buildLocalPreflightEnv: () => undefined }))

import { createLocalHostExecutor, createWslHostExecutor } from './host-program-executors'

const OK = { code: 0, stdout: '', stderr: '', timedOut: false, signal: null }

beforeEach(() => {
  mocks.runProcess.mockReset().mockResolvedValue(OK)
  mocks.runWslProcess.mockReset().mockResolvedValue(OK)
  mocks.resolve.mockReset()
})

describe('local executor', () => {
  it('runs the resolved program with argv and never a shell string', async () => {
    mocks.resolve.mockResolvedValue('/usr/bin/npm')
    await createLocalHostExecutor().run(['npm', 'install', '-g', 'gentle-pi'], 1000)
    expect(mocks.runProcess).toHaveBeenCalledWith(
      expect.objectContaining({ program: '/usr/bin/npm', args: ['install', '-g', 'gentle-pi'] })
    )
  })

  it('reports a missing program as data without starting anything', async () => {
    mocks.resolve.mockResolvedValue(null)
    const result = await createLocalHostExecutor().run(['winget', '--version'], 1000)
    expect(result).toMatchObject({ code: null, missing: true })
    expect(mocks.runProcess).not.toHaveBeenCalled()
  })

  it('runs a constant script through the platform interpreter with no profile', async () => {
    await createLocalHostExecutor().script('echo hi', 1000)
    const spec = mocks.runProcess.mock.calls[0]?.[0]
    if (process.platform === 'win32') {
      expect(spec.args).toEqual(['-NoProfile', '-NonInteractive', '-Command', 'echo hi'])
    } else {
      expect(spec).toMatchObject({ program: '/bin/sh', args: ['-c', 'echo hi'] })
    }
  })
})

describe('wsl executor', () => {
  it.runIf(process.platform === 'win32')(
    'runs a program with wsl argv and the login PATH',
    async () => {
      await createWslHostExecutor('Ubuntu').run(['npm', 'ls', '-g'], 5000)
      expect(mocks.runWslProcess).toHaveBeenCalledWith({
        distro: 'Ubuntu',
        program: 'npm',
        args: ['ls', '-g'],
        loginPath: 'preferred',
        timeoutMs: 5000
      })
    }
  )

  it.runIf(process.platform === 'win32')(
    'ignores Windows programs that WSL interop puts on the PATH',
    async () => {
      mocks.runWslProcess.mockResolvedValue({ ...OK, stdout: '/mnt/c/nvm4w/nodejs/npm\n' })
      await expect(createWslHostExecutor('Ubuntu').which('npm')).resolves.toEqual({
        state: 'absent'
      })
      mocks.runWslProcess.mockResolvedValue({ ...OK, stdout: '/usr/bin/npm\n' })
      await expect(createWslHostExecutor('Ubuntu').which('npm')).resolves.toEqual({
        state: 'found',
        path: '/usr/bin/npm'
      })
    }
  )

  it.runIf(process.platform !== 'win32')('refuses WSL where it does not exist', () => {
    expect(() => createWslHostExecutor('Ubuntu')).toThrow()
  })
})

describe('ssh executor', () => {
  it('gives every call its own relay lane so parallel lookups never cancel each other', async () => {
    const lanes: string[] = []
    const transport = vi.fn(async (_id: string, payload: { operation: string }) => {
      lanes.push(payload.operation)
      return { stdout: 'Linux\n', stderr: '', exitCode: 0, timedOut: false }
    })
    const exec = await createSshHostExecutor('box', transport)
    await Promise.all([exec.which('git'), exec.which('npm'), exec.which('curl')])
    expect(new Set(lanes).size).toBe(lanes.length)
  })

  it('caps a step at what the relay allows and passes argv through', async () => {
    const transport = vi.fn(async (_id: string, payload: { binary: string; args: string[] }) => ({
      stdout: payload.binary === 'uname' ? 'Darwin\n' : '',
      stderr: '',
      exitCode: 0,
      timedOut: false
    }))
    const exec = await createSshHostExecutor('box', transport)
    expect(exec.platform).toBe('darwin')
    await exec.run(['brew', 'install', 'git'], 20 * 60_000)
    expect(transport).toHaveBeenLastCalledWith('box', {
      binary: 'brew',
      args: ['install', 'git'],
      timeoutMs: 290_000,
      operation: expect.stringMatching(/^host-program-\d+$/)
    })
  })

  it('looks a command up only when its name is plain', async () => {
    const transport = vi.fn(async () => ({
      stdout: 'Linux\n',
      stderr: '',
      exitCode: 0,
      timedOut: false
    }))
    const exec = await createSshHostExecutor('box', transport)
    await expect(exec.which('git; rm -rf /')).resolves.toEqual({ state: 'absent' })
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
