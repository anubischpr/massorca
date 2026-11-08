import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote: boolean
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()

    constructor(
      _userDataPath?: string,
      _requestTimeoutMs?: number,
      remotePairingCode = process.env.ORCA_PAIRING_CODE ?? null,
      environmentSelector = process.env.ORCA_ENVIRONMENT ?? null
    ) {
      this.isRemote = Boolean(remotePairingCode || environmentSelector)
    }
  }

  // Why: re-export the REAL error classes; format.ts narrows with `instanceof`
  // against ./runtime/types, so a look-alike would collapse every CLI error
  // code into the generic `runtime_error` shape.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')

  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError
  }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'

const prototypeSets = [
  {
    requestId: 'req-1',
    sessionId: 'chat-1',
    agent: 'claude',
    worktreeId: 'wt-1',
    chatTitle: 'Pricing',
    title: 'Pricing page',
    originalPrompt: 'Make a pricing page',
    createdAt: '2026-11-01T10:00:00.000Z',
    count: 2
  },
  {
    requestId: 'req-2',
    sessionId: 'chat-2',
    agent: 'codex',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Settings screen',
    createdAt: '2026-11-02T10:00:00.000Z',
    count: 1,
    archived: true
  }
]

const usageState = {
  claude: {
    provider: 'claude',
    session: { usedPercent: 42.4, windowMinutes: 300, resetsAt: null, resetDescription: '2:30 PM' },
    weekly: { usedPercent: 10, windowMinutes: 10080, resetsAt: null, resetDescription: 'Thu' },
    error: null,
    status: 'ok',
    updatedAt: 1
  },
  codex: {
    provider: 'codex',
    session: null,
    weekly: {
      usedPercent: 5,
      windowMinutes: 10080,
      resetsAt: Date.UTC(2026, 10, 10, 12),
      resetDescription: null
    },
    error: 'upstream said no',
    status: 'error',
    updatedAt: 1
  },
  gemini: null,
  opencodeGo: null
}

const folderWorkspaces = [
  {
    id: 'fw-1',
    projectGroupId: 'group-1',
    name: 'Docs',
    folderPath: '/Users/me/Docs',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false
  },
  {
    id: 'fw-2',
    projectGroupId: 'group-1',
    name: 'Notes',
    folderPath: '/Users/me/Notes',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false
  }
]

describe('orca fork feature status CLI handlers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    // Why: these tests can run inside an Orca-managed terminal, which exports
    // real worktree/terminal/pairing env hints; clear them so handler context
    // assertions stay deterministic.
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('prototypes list', () => {
    it('lists every set when no worktree is given', async () => {
      queueFixtures(callMock, okFixture('req_sets', { sets: prototypeSets }))

      await main(['prototypes', 'list'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('prototypes.list', {})
      expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
        'Pricing page  request req-1  chat chat-1  claude\nUntitled set  request req-2  chat chat-2  codex  archived'
      )
    })

    it('passes --worktree as the worktreeId filter', async () => {
      queueFixtures(callMock, okFixture('req_sets', { sets: [prototypeSets[0]] }))

      await main(['prototypes', 'list', '--worktree', 'wt-1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('prototypes.list', { worktreeId: 'wt-1' })
    })

    it('prints the set list as the full JSON response', async () => {
      const response = okFixture('req_sets', { sets: prototypeSets })
      queueFixtures(callMock, response)

      await main(['prototypes', 'list', '--json'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('prototypes.list', {})
      expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
    })

    it('says so when the host has no sets', async () => {
      queueFixtures(callMock, okFixture('req_sets', { sets: [] }))

      await main(['prototypes', 'list'], '/tmp/repo')

      expect(vi.mocked(console.log).mock.calls[0][0]).toBe('No prototype sets.')
    })

    it('refuses a valueless --worktree instead of listing every set', async () => {
      await main(['prototypes', 'list', '--worktree'], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(vi.mocked(console.error).mock.calls[0][0]).toContain('requires a value')
      expect(process.exitCode).toBe(1)
    })
  })

  describe('jev status', () => {
    it('shows the enabled switch and that a key is stored, never the key value', async () => {
      queueFixtures(
        callMock,
        okFixture('req_jev', {
          enabled: true,
          apiKeyConfigured: true,
          apiKeyUnreadable: false,
          apiKeyProtection: 'plaintext',
          apiKey: 'SENTINEL-KEY-VALUE'
        })
      )

      await main(['jev', 'status'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('jevDecisions.getStatus')
      expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
        'Jev decisions: enabled\nAPI key: stored'
      )
    })

    it('says disabled and not stored when neither is set', async () => {
      queueFixtures(callMock, okFixture('req_jev', { enabled: false, apiKeyConfigured: false }))

      await main(['jev', 'status'], '/tmp/repo')

      expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
        'Jev decisions: disabled\nAPI key: not stored'
      )
    })

    it('prints only the switch and key presence as JSON', async () => {
      queueFixtures(
        callMock,
        okFixture('req_jev', {
          enabled: false,
          apiKeyConfigured: false,
          apiKey: 'SENTINEL-KEY-VALUE'
        })
      )

      await main(['jev', 'status', '--json'], '/tmp/repo')

      const printed = String(vi.mocked(console.log).mock.calls[0][0])
      expect(printed).not.toContain('SENTINEL-KEY-VALUE')
      expect(JSON.parse(printed)).toEqual({
        id: 'req_jev',
        ok: true,
        result: { enabled: false, apiKeyConfigured: false },
        _meta: { runtimeId: 'runtime-1' }
      })
    })
  })

  describe('account usage', () => {
    it('shows one line per provider with usage, without the provider error text', async () => {
      queueFixtures(callMock, okFixture('req_accounts', { rateLimits: usageState }))

      await main(['account', 'usage'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.list', { refreshUsage: false })
      const printed = vi.mocked(console.log).mock.calls[0][0]
      expect(printed).toBe(
        'Claude: session 42% (resets 2:30 PM), weekly 10% (resets Thu)\nCodex: session n/a, weekly 5% (resets 2026-11-10T12:00:00.000Z) [error]'
      )
      expect(printed).not.toContain('upstream said no')
    })

    it('asks the host to refresh usage first with --refresh', async () => {
      queueFixtures(callMock, okFixture('req_accounts', { rateLimits: usageState }))

      await main(['account', 'usage', '--refresh'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.list', { refreshUsage: true })
    })

    it('says so when no provider has usage yet', async () => {
      queueFixtures(callMock, okFixture('req_accounts', { rateLimits: { claude: null } }))

      await main(['account', 'usage'], '/tmp/repo')

      expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
        'No usage data yet. Run `orca account usage --refresh`.'
      )
    })

    it('prints the rate limit snapshot as the full JSON response', async () => {
      const response = okFixture('req_accounts', { rateLimits: usageState })
      queueFixtures(callMock, response)

      await main(['account', 'usage', '--json'], '/tmp/repo')

      expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual({
        ...response,
        result: usageState
      })
    })

    it('rejects a value for --refresh before calling the host', async () => {
      await main(['account', 'usage', '--refresh=now'], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(vi.mocked(console.error).mock.calls[0][0]).toContain('--refresh takes no value')
      expect(process.exitCode).toBe(1)
    })

    it('rejects --environment rather than answering for the local accounts', async () => {
      await main(['account', 'usage', '--environment', 'homelab'], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(vi.mocked(console.error).mock.calls[0][0]).toContain('does not retarget')
      expect(process.exitCode).toBe(1)
    })
  })

  describe('folder-workspace list', () => {
    it('lists each folder workspace with its id, name, and path', async () => {
      queueFixtures(callMock, okFixture('req_folders', { folderWorkspaces }))

      await main(['folder-workspace', 'list'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.list')
      expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
        'fw-1  Docs  /Users/me/Docs\nfw-2  Notes  /Users/me/Notes'
      )
    })

    it('prints the list as the full JSON response', async () => {
      const response = okFixture('req_folders', { folderWorkspaces })
      queueFixtures(callMock, response)

      await main(['folder-workspace', 'list', '--json'], '/tmp/repo')

      expect(JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))).toEqual(response)
    })

    it('says so when there are no folder workspaces', async () => {
      queueFixtures(callMock, okFixture('req_folders', { folderWorkspaces: [] }))

      await main(['folder-workspace', 'list'], '/tmp/repo')

      expect(vi.mocked(console.log).mock.calls[0][0]).toBe('No folder workspaces.')
    })
  })
})
