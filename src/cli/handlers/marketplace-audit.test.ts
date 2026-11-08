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

const STRUCTURE = {
  hostPicker: true,
  install: true,
  uninstall: false,
  connectionConfig: false,
  accessPolicy: true,
  sections: { banner: true, connection: false, advanced: false, danger: true }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    key: 'skill:caveman',
    section: 'Skills',
    name: 'caveman',
    status: { kind: 'installed', label: 'Installed' },
    targetKind: 'skill',
    page: { opens: true, pageKind: 'skill' },
    structure: STRUCTURE,
    source: 'native',
    ...overrides
  }
}

const BLOCKED = row({
  key: 'service:gitea',
  section: 'Services',
  name: 'Gitea',
  page: {
    opens: false,
    blockedCode: 'host-unsupported',
    blockedReason: 'SSH hosts cannot store it'
  },
  source: 'external',
  externalDependencies: ['tea']
})

function answer(result: unknown) {
  callMock.mockImplementation(async (method: string) => {
    if (method === 'ssh.listTargetSummaries') {
      return okFixture('req_ssh', { targets: [{ id: 'box-1', label: 'VPS' }] })
    }
    return okFixture(`req_${method}`, result)
  })
}

function auditParams(): unknown[] {
  return callMock.mock.calls
    .filter((call) => call[0] === 'marketplace.catalog.audit')
    .map((call) => call[1])
}

function output(stream: 'log' | 'error'): string {
  return vi
    .mocked(console[stream])
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

describe('orca marketplace audit', () => {
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

  it('prints one line per page with its block reason and structure', async () => {
    answer({ ok: true, host: { key: 'local', label: 'This computer' }, rows: [row(), BLOCKED] })

    await main(['marketplace', 'audit'], '/tmp/repo')

    expect(auditParams()).toEqual([{}])
    expect(callMock.mock.calls[0][2]).toEqual({ timeoutMs: 100_000 })
    const text = output('log')
    expect(text).toContain('Marketplace on This computer:')
    expect(text).toContain('Skills / caveman: opens → skill')
    expect(text).toContain(
      'Services / Gitea: blocked (host-unsupported): SSH hosts cannot store it'
    )
    expect(text).toContain(
      'has: host picker, install, access policy; sections: banner, danger; native'
    )
    expect(text).toContain('external (needs tea)')
    expect(process.exitCode).toBeUndefined()
  })

  it('sends the picked host and passes the result through as JSON', async () => {
    const result = { ok: true, host: { key: 'wsl:Ubuntu', label: 'WSL: Ubuntu' }, rows: [row()] }
    answer(result)

    await main(['marketplace', 'audit', '--host', 'wsl:Ubuntu', '--json'], '/tmp/repo')
    await main(['marketplace', 'audit', '--host', 'ssh:VPS', '--json'], '/tmp/repo')

    expect(auditParams()).toEqual([{ host: 'wsl:Ubuntu' }, { host: 'ssh:box-1' }])
    expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0])).result).toEqual(result)
  })

  it('asks this computer about a paired server instead of connecting to it', async () => {
    listEnvironmentsMock.mockReturnValue([{ id: 'env-vps', name: 'pv-vps' }])
    answer({ ok: true, host: { key: 'runtime:env-vps', label: 'pv-vps' }, rows: [row()] })

    await main(['marketplace', 'audit', '--host', 'runtime:pv-vps', '--json'], '/tmp/repo')

    expect(auditParams()).toEqual([{ host: 'runtime:env-vps' }])
    expect(runtimeClientArgs.at(-1)?.[3]).toBeUndefined()
  })

  it('exits 1 under --strict only when a page is blocked', async () => {
    answer({ ok: true, host: { key: 'local', label: 'This computer' }, rows: [row()] })
    await main(['marketplace', 'audit', '--strict'], '/tmp/repo')
    expect(process.exitCode).toBeUndefined()

    answer({ ok: true, host: { key: 'local', label: 'This computer' }, rows: [row(), BLOCKED] })
    await main(['marketplace', 'audit', '--strict'], '/tmp/repo')
    expect(process.exitCode).toBe(1)
  })

  it('explains a headless host and exits 1', async () => {
    answer({ ok: false, reason: 'no-renderer' })

    await main(['marketplace', 'audit'], '/tmp/repo')

    expect(output('error')).toContain('no-renderer (This host has no desktop window open')
    expect(process.exitCode).toBe(1)
  })
})
