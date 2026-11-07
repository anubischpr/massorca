import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  // Why: the real error classes, so format.ts keeps each CLI error code.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'
import { RuntimeRpcFailureError } from '../runtime/types'

const SECRET = 'om-secret-token-value'

function everyone() {
  return {
    agents: { mode: 'everyone', ids: [] },
    bots: { mode: 'everyone', botIds: [], teamIds: [] }
  }
}

function openMetadataApp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'openmetadata',
    connected: true,
    credential: { stored: true },
    serverUrl: 'https://om.example.com',
    profiles: [],
    agents: [
      { agent: 'claude', level: 'tools-only', entry: 'set', allowed: true, installed: true },
      { agent: 'codex', level: 'tools-only', entry: 'missing', allowed: true, installed: true },
      {
        agent: 'antigravity',
        level: 'tools-only',
        entry: 'missing',
        allowed: true,
        installed: false
      }
    ],
    access: everyone(),
    ...overrides
  }
}

function engramApp() {
  return {
    id: 'engram',
    connected: true,
    program: { found: true, version: '1.2.0' },
    credential: { stored: false },
    serverUrl: null,
    agents: [
      { agent: 'codex', level: 'full', entry: 'missing', allowed: true, installed: true },
      { agent: 'gentle-shell', level: 'full', entry: 'built-in', allowed: true, installed: true }
    ],
    access: everyone()
  }
}

function listFixture(apps: unknown[]) {
  return okFixture('req_list', { ok: true, apps })
}

function printed(): string {
  return vi
    .mocked(console.log)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

describe('orca marketplace CLI handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    delete process.env.ORCA_TEST_OM_TOKEN
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists apps with each agent state, naming the missing entries', async () => {
    queueFixtures(callMock, listFixture([engramApp(), openMetadataApp()]))

    await main(['marketplace', 'list'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('marketplace.apps.list', undefined)
    const out = printed()
    expect(out).toContain('OpenMetadata (openmetadata): connected')
    expect(out).toContain('  Codex: Missing')
    expect(out).toContain('  Claude Code: Set')
    expect(out).toContain('  Antigravity: Not installed')
    expect(out).toContain('  Gentle Shell: Built in')
    expect(out).not.toContain('Pi')
    expect(process.exitCode).toBeUndefined()
  })

  it('drops fields the contract does not know from --json output', async () => {
    queueFixtures(callMock, listFixture([{ ...openMetadataApp(), token: SECRET }]))

    await main(['marketplace', 'list', '--app', 'openmetadata', '--json'], '/tmp/repo')

    const out = printed()
    expect(JSON.parse(out).result[0].id).toBe('openmetadata')
    expect(out).not.toContain(SECRET)
  })

  it('repairs OpenMetadata from stored credentials without sending a token', async () => {
    queueFixtures(
      callMock,
      listFixture([openMetadataApp()]),
      okFixture('req_repair', { ok: true, status: openMetadataApp() })
    )

    await main(['marketplace', 'connect', 'openmetadata'], '/tmp/repo')

    expect(callMock).toHaveBeenLastCalledWith('marketplace.apps.setAccessPolicy', {
      id: 'openmetadata',
      policy: everyone()
    })
    expect(process.exitCode).toBeUndefined()
  })

  it('connects OpenMetadata to a new server with a token from an env var, never printing it', async () => {
    process.env.ORCA_TEST_OM_TOKEN = SECRET
    queueFixtures(
      callMock,
      listFixture([openMetadataApp({ serverUrl: null, connected: false })]),
      okFixture('req_connect', { ok: true, status: openMetadataApp() })
    )

    await main(
      [
        'marketplace',
        'connect',
        'openmetadata',
        '--server',
        'https://om.example.com',
        '--token-env',
        'ORCA_TEST_OM_TOKEN',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenLastCalledWith('marketplace.apps.connect', {
      id: 'openmetadata',
      url: 'https://om.example.com',
      token: SECRET
    })
    expect(printed()).not.toContain(SECRET)
    expect(process.exitCode).toBeUndefined()
  })

  it('refuses a token on the command line before calling the host', async () => {
    await main(['marketplace', 'connect', 'openmetadata', '--token', SECRET], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
    const errors = vi
      .mocked(console.error)
      .mock.calls.map((call) => String(call[0]))
      .join('\n')
    expect(errors).toContain('--token-stdin')
    expect(errors).not.toContain(SECRET)
  })

  it('refuses a first OpenMetadata connect without a server and token', async () => {
    queueFixtures(callMock, listFixture([openMetadataApp({ serverUrl: null, connected: false })]))

    await main(['marketplace', 'connect', 'openmetadata'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledTimes(1)
    expect(process.exitCode).toBe(1)
  })

  it('reconnects Engram through the plain connect call', async () => {
    queueFixtures(
      callMock,
      listFixture([engramApp()]),
      okFixture('req_engram', { ok: true, status: engramApp() })
    )

    await main(['marketplace', 'connect', 'engram'], '/tmp/repo')

    expect(callMock).toHaveBeenLastCalledWith('marketplace.apps.connect', { id: 'engram' })
  })

  it('reports a host failure reason and exits non-zero', async () => {
    queueFixtures(
      callMock,
      okFixture('req_disc', { ok: false, reason: 'outside-home', agent: 'codex' })
    )

    await main(['marketplace', 'disconnect', 'engram'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('marketplace.apps.disconnect', { id: 'engram' })
    expect(process.exitCode).toBe(1)
  })

  it('tells the caller to update an older host', async () => {
    callMock.mockRejectedValueOnce(
      new RuntimeRpcFailureError({
        id: 'req_old',
        ok: false,
        error: { code: 'method_not_found', message: 'nope' },
        _meta: { runtimeId: 'r' }
      })
    )

    await main(['marketplace', 'list'], '/tmp/repo')

    expect(process.exitCode).toBe(1)
    expect(String(vi.mocked(console.error).mock.calls[0]?.[0])).toContain('Update MassOrca')
  })

  it('shows the access mode, and sets only the agent half', async () => {
    const policy = {
      agents: { mode: 'everyone', ids: [] },
      bots: { mode: 'only', botIds: ['bot-1'], teamIds: [] }
    }
    queueFixtures(callMock, listFixture([openMetadataApp({ access: policy })]))
    await main(['marketplace', 'access', 'openmetadata'], '/tmp/repo')
    expect(printed()).toContain('OpenMetadata access: agents everyone; bots only 1 picked')

    queueFixtures(
      callMock,
      listFixture([openMetadataApp({ access: policy })]),
      okFixture('req_set', { ok: true, status: openMetadataApp() })
    )
    await main(
      ['marketplace', 'access', 'openmetadata', '--mode', 'except', '--agents', 'antigravity'],
      '/tmp/repo'
    )
    expect(callMock).toHaveBeenLastCalledWith('marketplace.apps.setAccessPolicy', {
      id: 'openmetadata',
      policy: { ...policy, agents: { mode: 'except', ids: ['antigravity'] } }
    })
  })
})

describe('orca marketplace services and skills CLI handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows every service, reading an absent check as unknown', async () => {
    callMock.mockImplementation(async (method: string) => {
      if (method === 'preflight.check') {
        return okFixture('req_pf', {
          git: { installed: true },
          gh: { installed: true, authenticated: true },
          glab: { installed: true, authenticated: true },
          bitbucket: { configured: false, authenticated: false, account: null }
        })
      }
      if (method === 'linear.status') {
        return okFixture('req_lin', {
          connected: true,
          viewer: { displayName: 'Ana', email: 'ana@example.com', organizationName: 'Acme' }
        })
      }
      throw new RuntimeRpcFailureError({
        id: 'req_jira',
        ok: false,
        error: { code: 'method_not_found', message: 'nope' },
        _meta: { runtimeId: 'r' }
      })
    })

    await main(['marketplace', 'services', 'list'], '/tmp/repo')

    const out = printed()
    expect(out).toContain('GitLab: connected')
    expect(out).toContain('Bitbucket: not connected')
    expect(out).toContain('Azure DevOps: unknown')
    expect(out).toContain('Linear: connected as ana@example.com (Acme)')
    expect(out).toContain('Jira: unknown')
    expect(process.exitCode).toBeUndefined()
  })

  it('connects Linear with a token from stdin-free env input', async () => {
    process.env.ORCA_TEST_OM_TOKEN = SECRET
    callMock.mockImplementation(async (method: string) => {
      if (method === 'linear.connect') {
        return okFixture('req_c', { ok: true })
      }
      if (method === 'linear.status') {
        return okFixture('req_s', { connected: true, viewer: null })
      }
      return okFixture('req_o', null)
    })

    await main(
      ['marketplace', 'services', 'connect', 'linear', '--token-env', 'ORCA_TEST_OM_TOKEN'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('linear.connect', { apiKey: SECRET })
    expect(printed()).toContain('Linear: connected')
    expect(printed()).not.toContain(SECRET)
  })

  it('names the old route when the host predates the service vault methods', async () => {
    process.env.ORCA_TEST_OM_TOKEN = SECRET
    callMock.mockRejectedValueOnce(
      new RuntimeRpcFailureError({
        id: 'req_old',
        ok: false,
        error: { code: 'method_not_found', message: 'nope' },
        _meta: { runtimeId: 'r' }
      })
    )

    await main(
      ['marketplace', 'services', 'connect', 'gitlab', '--token-env', 'ORCA_TEST_OM_TOKEN'],
      '/tmp/repo'
    )

    expect(process.exitCode).toBe(1)
    const errors = String(vi.mocked(console.error).mock.calls[0]?.[0])
    expect(errors).toContain('glab auth login')
    expect(errors).not.toContain(SECRET)
  })

  it('connects Gitea into the host vault with a server URL, never printing the token', async () => {
    process.env.ORCA_TEST_OM_TOKEN = SECRET
    callMock.mockImplementation(async (method: string) =>
      method === 'marketplace.service.connect'
        ? okFixture('req_c', { ok: true })
        : okFixture('req_o', null)
    )

    await main(
      [
        'marketplace',
        'services',
        'connect',
        'gitea',
        '--site',
        'https://git.example.com',
        '--token-env',
        'ORCA_TEST_OM_TOKEN',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('marketplace.service.connect', {
      service: 'gitea',
      token: SECRET,
      baseUrl: 'https://git.example.com'
    })
    expect(printed()).not.toContain(SECRET)
    expect(process.exitCode).toBeUndefined()
  })

  it('exits 1 with the host reason when the vault rejects a token', async () => {
    process.env.ORCA_TEST_OM_TOKEN = SECRET
    queueFixtures(
      callMock,
      okFixture('req_c', { ok: false, reason: 'rejected', message: 'bad credentials' })
    )

    await main(
      [
        'marketplace',
        'services',
        'connect',
        'bitbucket',
        '--email',
        'me@example.com',
        '--token-env',
        'ORCA_TEST_OM_TOKEN'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('marketplace.service.connect', {
      service: 'bitbucket',
      token: SECRET,
      email: 'me@example.com'
    })
    expect(process.exitCode).toBe(1)
    const errors = String(vi.mocked(console.error).mock.calls[0]?.[0])
    expect(errors).toContain('rejected (bad credentials)')
    expect(errors).not.toContain(SECRET)
  })

  it('disconnects Azure DevOps through the vault and keeps Linear on its own method', async () => {
    callMock.mockImplementation(async () => okFixture('req_x', { ok: true }))

    await main(['marketplace', 'services', 'disconnect', 'azure-devops'], '/tmp/repo')
    expect(callMock).toHaveBeenCalledWith('marketplace.service.disconnect', {
      service: 'azure-devops'
    })

    await main(['marketplace', 'services', 'disconnect', 'linear'], '/tmp/repo')
    expect(callMock).toHaveBeenCalledWith('linear.disconnect', {})
  })

  it('uninstalls a skill globally and fails when the host does not remove it', async () => {
    queueFixtures(
      callMock,
      okFixture('req_rm', {
        operationId: 'x',
        status: 'conflict',
        name: 'caveman',
        packageDigest: ''
      })
    )

    await main(['marketplace', 'skills', 'uninstall', 'caveman'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith(
      'skills.removeInstall',
      expect.objectContaining({ name: 'caveman', destination: { scope: 'global' } })
    )
    expect(process.exitCode).toBe(1)
  })
})
