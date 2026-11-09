import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MARKETPLACE_PROGRAM_INSTALL_METHOD,
  MARKETPLACE_PROGRAM_REINSTALL_METHOD,
  MARKETPLACE_PROGRAM_STATUS_METHOD,
  MARKETPLACE_PROGRAM_UNINSTALL_METHOD,
  MarketplaceHostProgramParams
} from '../../../../shared/rpc-contract/marketplace-host-program-params'
import { setHostProgramTransports } from '../../../marketplace/host-programs/host-program-router'
import { fakeHost } from '../../../marketplace/host-programs/host-program-test-host'
import type { RpcContext } from '../core'
import { ALL_RPC_METHODS } from './index'
import {
  marketplaceProgramInstallMethod,
  marketplaceProgramStatusMethod,
  marketplaceProgramUninstallMethod
} from './marketplace-host-program-methods'

const executors = vi.hoisted(() => ({ local: null as unknown, wsl: vi.fn() }))

vi.mock('../../../marketplace/host-programs/host-program-executors', () => ({
  createLocalHostExecutor: () => executors.local,
  createWslHostExecutor: (distro: string) => executors.wsl(distro)
}))

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the host-program handlers read no part of the context.
const context = {} as RpcContext

afterEach(() => {
  setHostProgramTransports({ ssh: null, runtime: null })
  executors.wsl.mockReset()
})

describe('marketplace.program params', () => {
  it('accepts an absent host and each host key shape', () => {
    for (const host of [undefined, 'local', 'runtime:abc', 'ssh:x', 'wsl:Ubuntu-24.04']) {
      expect(MarketplaceHostProgramParams.safeParse({ program: 'git', host }).success).toBe(true)
    }
  })

  it('rejects an unknown program, an unknown host prefix and an empty host id', () => {
    expect(MarketplaceHostProgramParams.safeParse({ program: 'pi' }).success).toBe(false)
    expect(MarketplaceHostProgramParams.safeParse({ program: 'git', host: 'foo' }).success).toBe(
      false
    )
    expect(MarketplaceHostProgramParams.safeParse({ program: 'git', host: 'ssh:' }).success).toBe(
      false
    )
  })

  it('puts status with the Marketplace level and the programs it changes at host-admin', () => {
    const permissionOf = (name: string) =>
      ALL_RPC_METHODS.find((method) => method.name === name)?.permission
    expect(permissionOf(MARKETPLACE_PROGRAM_STATUS_METHOD)).toBe('accounts-admin')
    for (const name of [
      MARKETPLACE_PROGRAM_INSTALL_METHOD,
      MARKETPLACE_PROGRAM_REINSTALL_METHOD,
      MARKETPLACE_PROGRAM_UNINSTALL_METHOD
    ]) {
      expect(permissionOf(name)).toBe('host-admin')
    }
  })
})

describe('marketplace.program on this machine', () => {
  it('answers not-installed for an uninstall of a program that is absent', async () => {
    executors.local = fakeHost({ platform: 'linux', present: {} })
    await expect(
      marketplaceProgramUninstallMethod.handler({ program: 'git' }, context)
    ).resolves.toEqual({ ok: false, reason: 'not-installed' })
  })

  it('answers the status of a program that is installed', async () => {
    executors.local = fakeHost({ platform: 'linux', present: { git: '/opt/git' } })
    await expect(
      marketplaceProgramStatusMethod.handler({ program: 'git' }, context)
    ).resolves.toMatchObject({
      ok: true,
      installed: true
    })
  })
})

describe('marketplace.program on other hosts', () => {
  it('sends a paired host the same call with no host, so it answers for itself', async () => {
    const forward = vi.fn(async () => ({
      ok: true as const,
      result: { ok: true, version: 'git 2' }
    }))
    setHostProgramTransports({ ssh: null, runtime: forward })
    await expect(
      marketplaceProgramInstallMethod.handler({ program: 'git', host: 'runtime:env-1' }, context)
    ).resolves.toEqual({ ok: true, version: 'git 2' })
    expect(forward).toHaveBeenCalledWith(
      'env-1',
      MARKETPLACE_PROGRAM_INSTALL_METHOD,
      { program: 'git' },
      expect.any(Number)
    )
  })

  it('reads a paired host answer from its known fields only', async () => {
    setHostProgramTransports({
      ssh: null,
      runtime: async () => ({
        ok: true,
        result: { ok: false, reason: 'needs-admin', command: 'sudo x', token: 'secret' }
      })
    })
    const answer = await marketplaceProgramInstallMethod.handler(
      { program: 'git', host: 'runtime:e' },
      context
    )
    expect(answer).toEqual({ ok: false, reason: 'needs-admin', command: 'sudo x' })
  })

  it('tells the person to update a paired host that predates the methods', async () => {
    setHostProgramTransports({
      ssh: null,
      runtime: async () => ({ ok: false, failureCode: 'method_not_found' })
    })
    await expect(
      marketplaceProgramInstallMethod.handler({ program: 'git', host: 'runtime:e' }, context)
    ).resolves.toMatchObject({ ok: false, reason: 'host-needs-update' })
  })

  it('reports an unreachable paired host and an unreadable answer without a crash', async () => {
    setHostProgramTransports({
      ssh: null,
      runtime: async () => ({ ok: false, failureCode: 'timeout' })
    })
    await expect(
      marketplaceProgramStatusMethod.handler({ program: 'git', host: 'runtime:e' }, context)
    ).resolves.toMatchObject({ ok: false, reason: 'unreachable' })
    setHostProgramTransports({ ssh: null, runtime: async () => ({ ok: true, result: 'nope' }) })
    await expect(
      marketplaceProgramStatusMethod.handler({ program: 'git', host: 'runtime:e' }, context)
    ).resolves.toEqual({ ok: false, reason: 'failed' })
  })

  it('runs a WSL distro through the WSL executor', async () => {
    executors.wsl.mockReturnValue(fakeHost({ platform: 'linux', present: {} }))
    await expect(
      marketplaceProgramUninstallMethod.handler(
        { program: 'git', host: 'wsl:Ubuntu-24.04' },
        context
      )
    ).resolves.toEqual({ ok: false, reason: 'not-installed' })
    expect(executors.wsl).toHaveBeenCalledWith('Ubuntu-24.04')
  })

  it('reports unreachable when the SSH host has no live connection', async () => {
    setHostProgramTransports({ ssh: async () => null, runtime: null })
    await expect(
      marketplaceProgramInstallMethod.handler({ program: 'git', host: 'ssh:box' }, context)
    ).resolves.toMatchObject({ ok: false, reason: 'unreachable' })
  })

  it('drives an SSH host through its relay and detects its platform first', async () => {
    const seen: string[] = []
    setHostProgramTransports({
      runtime: null,
      ssh: async (_id, payload) => {
        seen.push([payload.binary, ...payload.args].join(' '))
        if (payload.binary === 'uname') {
          return { stdout: 'Linux\n', stderr: '', exitCode: 0, timedOut: false }
        }
        return { stdout: '', stderr: '', exitCode: 1, timedOut: false }
      }
    })
    await expect(
      marketplaceProgramUninstallMethod.handler({ program: 'git', host: 'ssh:box' }, context)
    ).resolves.toEqual({ ok: false, reason: 'not-installed' })
    expect(seen[0]).toBe('uname -s')
  })

  it('reports unsupported for an SSH host that is not Linux or macOS', async () => {
    setHostProgramTransports({
      runtime: null,
      ssh: async () => ({
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        spawnError: 'ENOENT'
      })
    })
    await expect(
      marketplaceProgramInstallMethod.handler({ program: 'git', host: 'ssh:win' }, context)
    ).resolves.toMatchObject({ ok: false, reason: 'unsupported' })
  })

  it('never removes Node.js from an SSH host, because MassOrca relay runs on it', async () => {
    const ssh = vi.fn()
    setHostProgramTransports({ ssh, runtime: null })
    await expect(
      marketplaceProgramUninstallMethod.handler({ program: 'node', host: 'ssh:box' }, context)
    ).resolves.toMatchObject({ ok: false, reason: 'unsupported' })
    expect(ssh).not.toHaveBeenCalled()
  })
})
