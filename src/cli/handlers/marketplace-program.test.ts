import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callMock, listEnvironmentsMock, runtimeClientArgs } = vi.hoisted(() => ({
  callMock: vi.fn(),
  listEnvironmentsMock: vi.fn(() => [] as { id: string; name: string }[]),
  runtimeClientArgs: [] as unknown[][]
}))

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    constructor(...args: unknown[]) {
      runtimeClientArgs.push(args)
    }
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  // Why: the real error classes, so format.ts keeps each CLI error code.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError,
    getDefaultUserDataPath: () => '/tmp/orca-user-data'
  }
})

vi.mock('../runtime/environments', () => ({
  addEnvironmentFromPairingCode: vi.fn(),
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

import { main } from '../index'
import { okFixture } from '../test-fixtures'

function answer(result: unknown) {
  callMock.mockImplementation(async (method: string) => okFixture(`req_${method}`, result))
}

function output(stream: 'log' | 'error'): string {
  return vi
    .mocked(console[stream])
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

describe('orca marketplace program', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    listEnvironmentsMock.mockReturnValue([])
    runtimeClientArgs.length = 0
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('prints status with the install method and the commands', async () => {
    answer({
      ok: true,
      installed: true,
      version: '2.60.0',
      path: '/usr/bin/gh',
      method: 'apt',
      uninstallCommand: 'sudo apt remove gh',
      canInstall: false,
      canUninstall: false,
      canReinstall: false
    })

    await main(['marketplace', 'program', 'status', 'gh', '--host', 'wsl:Ubuntu'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith(
      'marketplace.program.status',
      { program: 'gh', host: 'wsl:Ubuntu' },
      { timeoutMs: 26 * 60_000 }
    )
    const text = output('log')
    expect(text).toContain('gh: installed 2.60.0 via apt')
    expect(text).toContain('path: /usr/bin/gh')
    expect(text).toContain('MassOrca can: nothing here')
    expect(text).toContain('uninstall command: sudo apt remove gh')
    expect(process.exitCode).toBeUndefined()
  })

  it('sends a paired server as the host and stays connected here', async () => {
    listEnvironmentsMock.mockReturnValue([{ id: 'env-vps', name: 'pv-vps' }])
    answer({ ok: true, version: '1.0.0' })

    await main(
      ['marketplace', 'program', 'install', 'codex', '--host', 'runtime:pv-vps', '--json'],
      '/tmp/repo'
    )

    expect(callMock.mock.calls[0][1]).toEqual({ program: 'codex', host: 'runtime:env-vps' })
    expect(runtimeClientArgs.at(-1)?.[3]).toBeUndefined()
    expect(JSON.parse(output('log')).result).toEqual({ ok: true, version: '1.0.0' })
  })

  it('prints the command to run when the host needs admin rights, and exits 1', async () => {
    answer({
      ok: false,
      reason: 'needs-admin',
      message: 'Installing Node needs administrator rights.',
      command: 'winget install OpenJS.NodeJS.LTS'
    })

    await main(['marketplace', 'program', 'install', 'node'], '/tmp/repo')

    const text = output('log')
    expect(text).toContain('node: could not install (needs-admin)')
    expect(text).toContain('Run this yourself: winget install OpenJS.NodeJS.LTS')
    expect(process.exitCode).toBe(1)
  })

  it('asks for --yes before uninstall or reinstall unless --json is set', async () => {
    answer({ ok: true, message: 'Removed /usr/local/bin/claude' })

    await main(['marketplace', 'program', 'uninstall', 'claude'], '/tmp/repo')
    expect(output('error')).toContain('Re-run with --yes to confirm')
    expect(callMock).not.toHaveBeenCalled()

    await main(['marketplace', 'program', 'reinstall', 'claude', '--yes'], '/tmp/repo')
    await main(['marketplace', 'program', 'uninstall', 'claude', '--json'], '/tmp/repo')
    expect(callMock.mock.calls.map((call) => call[0])).toEqual([
      'marketplace.program.reinstall',
      'marketplace.program.uninstall'
    ])
    expect(output('log')).toContain('claude: reinstall done\n  Removed /usr/local/bin/claude')
  })

  it('refuses a program it does not know before calling the host', async () => {
    await main(['marketplace', 'program', 'status', 'python'], '/tmp/repo')

    expect(output('error')).toContain('Unknown program "python"')
    expect(callMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
