import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  // Why: re-export the REAL error classes; format.ts narrows with `instanceof`.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')

  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'

const SESSION = 'chat-1'
const REQUEST = 'req-1'
const SENTINEL_KEY = 'SENTINEL-JEV-KEY-VALUE'

function out(): string {
  return vi
    .mocked(console.log)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

function err(): string {
  return vi
    .mocked(console.error)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

describe('orca fork feature write CLI handlers', () => {
  const originalEnv = { ...process.env }
  let scratch: string | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    for (const name of [
      'ORCA_WORKTREE_ID',
      'ORCA_TERMINAL_HANDLE',
      'ORCA_PAIRING_CODE',
      'ORCA_ENVIRONMENT',
      'ORCA_CLI_WSL_DISTRO'
    ]) {
      delete process.env[name]
    }
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (scratch) {
      rmSync(scratch, { recursive: true, force: true })
      scratch = null
    }
    process.exitCode = undefined
  })

  describe('prototypes', () => {
    it('creates a request with every option and prints its id and folder', async () => {
      queueFixtures(
        callMock,
        okFixture('r', { ok: true, requestId: 'req-9', folderPath: '/state/visuals/req-9' })
      )

      await main(
        [
          'prototypes',
          'create',
          '--session',
          SESSION,
          '--agent',
          'claude',
          '--prompt',
          'A pricing page',
          '--count',
          '3',
          '--worktree',
          'wt-1',
          '--chat-title',
          'Pricing',
          '--design-system',
          'propose'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.createRequest', {
        sessionId: SESSION,
        agent: 'claude',
        originalPrompt: 'A pricing page',
        count: 3,
        worktreeId: 'wt-1',
        chatTitle: 'Pricing',
        designSystem: 'propose'
      })
      expect(out()).toBe('Created request req-9\nFolder: /state/visuals/req-9')
      expect(process.exitCode).toBeUndefined()
    })

    it('sends only the required fields when the options are left out', async () => {
      queueFixtures(callMock, okFixture('r', { ok: true, requestId: 'req-9', folderPath: '/f' }))

      await main(
        [
          'prototypes',
          'create',
          '--session',
          SESSION,
          '--agent',
          'codex',
          '--prompt',
          'x',
          '--count',
          '1'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.createRequest', {
        sessionId: SESSION,
        agent: 'codex',
        originalPrompt: 'x',
        count: 1
      })
    })

    it('prints the host reply as the full JSON response', async () => {
      const response = okFixture('r', { ok: true, requestId: 'req-9', folderPath: '/f' })
      queueFixtures(callMock, response)

      await main(
        [
          'prototypes',
          'create',
          '--session',
          SESSION,
          '--agent',
          'codex',
          '--prompt',
          'x',
          '--count',
          '2',
          '--json'
        ],
        '/tmp/repo'
      )

      expect(JSON.parse(out())).toEqual(response)
    })

    it('exits 1 with the host reason when the request is refused', async () => {
      queueFixtures(callMock, okFixture('r', { ok: false, error: 'unsupported' }))

      await main(
        [
          'prototypes',
          'create',
          '--session',
          SESSION,
          '--agent',
          'codex',
          '--prompt',
          'x',
          '--count',
          '2'
        ],
        '/tmp/repo'
      )

      expect(err()).toContain('unsupported')
      expect(process.exitCode).toBe(1)
    })

    it.each([
      [['--agent', 'nope', '--count', '2'], '--agent'],
      [['--agent', 'claude', '--count', '9'], '--count'],
      [['--agent', 'claude', '--count', '2', '--design-system', 'maybe'], '--design-system']
    ])('refuses bad input %j before calling the host', async (extra, flag) => {
      await main(
        ['prototypes', 'create', '--session', SESSION, '--prompt', 'x', ...extra],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain(flag)
      expect(process.exitCode).toBe(1)
    })

    it.each([
      ['archive', 'prototypes.archive', 'Archived request req-1.'],
      ['unarchive', 'prototypes.unarchive', 'Unarchived request req-1.'],
      ['rm', 'prototypes.delete', 'Deleted request req-1.']
    ])('%s targets one request of one chat', async (verb, method, message) => {
      queueFixtures(callMock, okFixture('r', { ok: true }))

      await main(['prototypes', verb, '--session', SESSION, '--request', REQUEST], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith(method, { sessionId: SESSION, requestId: REQUEST })
      expect(out()).toBe(message)
    })

    it('exits 1 when the host will not delete a set whose chat still exists', async () => {
      queueFixtures(callMock, okFixture('r', { ok: false, error: 'not_deletable' }))

      await main(['prototypes', 'rm', '--session', SESSION, '--request', REQUEST], '/tmp/repo')

      expect(err()).toContain('not_deletable')
      expect(process.exitCode).toBe(1)
    })

    it('refuses archive without --request', async () => {
      await main(['prototypes', 'archive', '--session', SESSION], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--request')
      expect(process.exitCode).toBe(1)
    })

    it('restores one direction version and prints the new file', async () => {
      queueFixtures(callMock, okFixture('r', { ok: true, fileName: 'A-v3.html', version: 3 }))

      await main(
        [
          'prototypes',
          'restore-version',
          '--session',
          SESSION,
          '--request',
          REQUEST,
          '--letter',
          'A',
          '--version',
          '2'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.restoreVersion', {
        sessionId: SESSION,
        requestId: REQUEST,
        letter: 'A',
        version: 2
      })
      expect(out()).toBe('Restored direction A version 2 as A-v3.html (version 3).')
    })

    it('refuses a lowercase direction letter', async () => {
      await main(
        [
          'prototypes',
          'restore-version',
          '--session',
          SESSION,
          '--request',
          REQUEST,
          '--letter',
          'a',
          '--version',
          '2'
        ],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--letter')
      expect(process.exitCode).toBe(1)
    })

    it('uploads a note screenshot as base64 under the given name', async () => {
      scratch = mkdtempSync(join(tmpdir(), 'orca-proto-attach-'))
      const png = join(scratch, 'note.png')
      writeFileSync(png, Buffer.from([1, 2, 3, 4]))
      queueFixtures(callMock, okFixture('r', { ok: true, path: '/state/req-1/notes/note-1.png' }))

      await main(
        [
          'prototypes',
          'write-attachment',
          '--session',
          SESSION,
          '--request',
          REQUEST,
          '--name',
          'note-1',
          '--image',
          png
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.writeAttachment', {
        sessionId: SESSION,
        requestId: REQUEST,
        name: 'note-1',
        pngBase64: Buffer.from([1, 2, 3, 4]).toString('base64')
      })
      expect(out()).toBe('Wrote /state/req-1/notes/note-1.png')
    })

    it('says so when the screenshot file cannot be read', async () => {
      await main(
        [
          'prototypes',
          'write-attachment',
          '--session',
          SESSION,
          '--request',
          REQUEST,
          '--name',
          'n',
          '--image',
          join(tmpdir(), 'orca-missing-note.png')
        ],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--image')
      expect(process.exitCode).toBe(1)
    })

    it('prints the html of one request file', async () => {
      queueFixtures(callMock, okFixture('r', { ok: true, html: '<h1>A</h1>' }))

      await main(
        [
          'prototypes',
          'read-file',
          '--session',
          SESSION,
          '--request',
          REQUEST,
          '--file',
          'A-v1.html'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.readFile', {
        sessionId: SESSION,
        requestId: REQUEST,
        fileName: 'A-v1.html'
      })
      expect(out()).toBe('<h1>A</h1>')
    })

    it("exits 1 when the file is not the request's", async () => {
      queueFixtures(callMock, okFixture('r', { ok: false, error: 'not_found' }))

      await main(
        ['prototypes', 'read-file', '--session', SESSION, '--request', REQUEST, '--file', 'x.html'],
        '/tmp/repo'
      )

      expect(err()).toContain('not_found')
      expect(process.exitCode).toBe(1)
    })

    it('reads the design system of a chat and lists its files', async () => {
      queueFixtures(
        callMock,
        okFixture('r', {
          ok: true,
          projectKey: 'k',
          projectName: 'Orca',
          fileNames: ['design/tokens.json'],
          tokensJson: '{}'
        })
      )

      await main(['prototypes', 'design-system', 'read', '--session', SESSION], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('prototypes.readDesignSystem', { sessionId: SESSION })
      expect(out()).toContain('Orca')
      expect(out()).toContain('design/tokens.json')
    })

    it('lists the saved versions of a design system', async () => {
      queueFixtures(
        callMock,
        okFixture('r', {
          ok: true,
          versions: [
            { version: 2, saved: true, current: true },
            { version: 1, saved: false, current: false, at: '2026-11-01' }
          ]
        })
      )

      await main(['prototypes', 'design-system', 'versions', '--session', SESSION], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('prototypes.listDesignSystemVersions', {
        sessionId: SESSION
      })
      expect(out()).toBe('v2  saved  current\nv1  not saved  2026-11-01')
    })

    it('reads one saved design system version', async () => {
      queueFixtures(
        callMock,
        okFixture('r', { ok: true, projectKey: 'k', projectName: 'Orca', fileNames: ['a'] })
      )

      await main(
        ['prototypes', 'design-system', 'version', '--session', SESSION, '--version', '2'],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.readDesignSystemVersion', {
        sessionId: SESSION,
        version: 2
      })
    })

    it('restores a design system version', async () => {
      queueFixtures(callMock, okFixture('r', { ok: true, version: 4 }))

      await main(
        ['prototypes', 'design-system', 'restore', '--session', SESSION, '--version', '1'],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('prototypes.restoreDesignSystemVersion', {
        sessionId: SESSION,
        version: 1
      })
      expect(out()).toBe('Restored design system version 1 as version 4.')
    })

    it('exits 1 when the version is already current', async () => {
      queueFixtures(callMock, okFixture('r', { ok: false, error: 'current' }))

      await main(
        ['prototypes', 'design-system', 'restore', '--session', SESSION, '--version', '1'],
        '/tmp/repo'
      )

      expect(err()).toContain('current')
      expect(process.exitCode).toBe(1)
    })
  })

  describe('jev', () => {
    const status = { enabled: true, apiKeyConfigured: true, apiKey: SENTINEL_KEY }

    it.each([
      ['enable', true, 'Jev decisions: enabled\nAPI key: stored'],
      ['disable', false, 'Jev decisions: enabled\nAPI key: stored']
    ])('%s sets the switch and prints the status', async (verb, enabled, printed) => {
      queueFixtures(callMock, okFixture('r', status))

      await main(['jev', verb], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('jevDecisions.setEnabled', { enabled })
      expect(out()).toBe(printed)
      expect(out()).not.toContain(SENTINEL_KEY)
    })

    it('saves the key from an env var and never prints it', async () => {
      process.env.ORCA_TEST_JEV_KEY = SENTINEL_KEY
      queueFixtures(callMock, okFixture('r', status))

      await main(['jev', 'set-key', '--key-env', 'ORCA_TEST_JEV_KEY'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('jevDecisions.saveApiKey', { apiKey: SENTINEL_KEY })
      expect(out()).toBe('Jev decisions: enabled\nAPI key: stored')
      expect(out()).not.toContain(SENTINEL_KEY)
      expect(err()).not.toContain(SENTINEL_KEY)
    })

    it('keeps the key out of --json output too', async () => {
      process.env.ORCA_TEST_JEV_KEY = SENTINEL_KEY
      queueFixtures(callMock, okFixture('r', status))

      await main(['jev', 'set-key', '--key-env', 'ORCA_TEST_JEV_KEY', '--json'], '/tmp/repo')

      expect(out()).not.toContain(SENTINEL_KEY)
      expect(JSON.parse(out()).result).toEqual({ enabled: true, apiKeyConfigured: true })
    })

    it('refuses the key on the command line without echoing it', async () => {
      await main(['jev', 'set-key', '--key', SENTINEL_KEY], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--key-stdin')
      expect(err()).not.toContain(SENTINEL_KEY)
      expect(process.exitCode).toBe(1)
    })

    it('asks for a key source when none is given', async () => {
      await main(['jev', 'set-key'], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--key-env')
      expect(process.exitCode).toBe(1)
    })

    it('clears the stored key', async () => {
      queueFixtures(callMock, okFixture('r', { enabled: false, apiKeyConfigured: false }))

      await main(['jev', 'clear-key'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('jevDecisions.clearApiKey')
      expect(out()).toBe('Jev decisions: disabled\nAPI key: not stored')
    })
  })

  describe('folder-workspace', () => {
    const row = {
      id: 'fw-1',
      projectGroupId: 'group-1',
      name: 'Docs',
      folderPath: '/Users/me/Docs'
    }

    it('creates a folder workspace in a project group', async () => {
      queueFixtures(callMock, okFixture('r', { folderWorkspace: row }))

      await main(
        [
          'folder-workspace',
          'create',
          '--group',
          'group-1',
          '--name',
          'Docs',
          '--path',
          '/Users/me/Docs',
          '--connection',
          'ssh-1'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.create', {
        projectGroupId: 'group-1',
        name: 'Docs',
        folderPath: '/Users/me/Docs',
        connectionId: 'ssh-1'
      })
      expect(out()).toBe('Created fw-1  Docs  /Users/me/Docs')
    })

    it('creates with only the group', async () => {
      queueFixtures(callMock, okFixture('r', { folderWorkspace: row }))

      await main(['folder-workspace', 'create', '--group', 'group-1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.create', { projectGroupId: 'group-1' })
    })

    it('updates only the fields that were given', async () => {
      queueFixtures(callMock, okFixture('r', { folderWorkspace: { ...row, name: 'Notes' } }))

      await main(
        [
          'folder-workspace',
          'update',
          '--workspace',
          'fw-1',
          '--name',
          'Notes',
          '--archived',
          'true',
          '--pinned',
          'false',
          '--comment',
          'hi'
        ],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.update', {
        folderWorkspaceId: 'fw-1',
        updates: { name: 'Notes', isArchived: true, isPinned: false, comment: 'hi' }
      })
      expect(out()).toBe('Updated fw-1  Notes  /Users/me/Docs')
    })

    it('refuses an update with nothing to change', async () => {
      await main(['folder-workspace', 'update', '--workspace', 'fw-1'], '/tmp/repo')

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('Nothing to update')
      expect(process.exitCode).toBe(1)
    })

    it('refuses a non-boolean --archived', async () => {
      await main(
        ['folder-workspace', 'update', '--workspace', 'fw-1', '--archived', 'soon'],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--archived')
      expect(process.exitCode).toBe(1)
    })

    it('deletes a folder workspace and says whether it was found', async () => {
      queueFixtures(callMock, okFixture('r', { deleted: true }))

      await main(['folder-workspace', 'rm', '--workspace', 'fw-1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.delete', { folderWorkspaceId: 'fw-1' })
      expect(out()).toBe('Deleted fw-1.')
    })

    it('exits 1 when there was nothing to delete', async () => {
      queueFixtures(callMock, okFixture('r', { deleted: false }))

      await main(['folder-workspace', 'rm', '--workspace', 'fw-1'], '/tmp/repo')

      expect(err()).toContain('fw-1')
      expect(process.exitCode).toBe(1)
    })

    it.each([
      [['--workspace', 'fw-1'], { scope: 'folder-workspace', folderWorkspaceId: 'fw-1' }],
      [['--group', 'group-1'], { scope: 'project-group', projectGroupId: 'group-1' }],
      [
        ['--path', '/a/b', '--connection', 'ssh-1'],
        { scope: 'path', path: '/a/b', connectionId: 'ssh-1' }
      ]
    ])('checks a path by scope %j', async (flags, params) => {
      queueFixtures(callMock, okFixture('r', { status: { path: '/a/b', exists: true } }))

      await main(['folder-workspace', 'path-status', ...flags], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('folderWorkspace.getPathStatus', params)
      expect(out()).toBe('/a/b  exists')
    })

    it('reports a missing folder with the reason', async () => {
      queueFixtures(
        callMock,
        okFixture('r', { status: { path: '/gone', exists: false, reason: 'missing' } })
      )

      await main(['folder-workspace', 'path-status', '--path', '/gone'], '/tmp/repo')

      expect(out()).toBe('/gone  missing')
    })

    it('refuses two scopes at once', async () => {
      await main(
        ['folder-workspace', 'path-status', '--workspace', 'a', '--group', 'b'],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    })
  })

  describe('account', () => {
    const claudeState = {
      accounts: [{ id: 'c1', email: 'me@example.com' }],
      activeAccountId: 'c1'
    }

    it('selects a Claude account', async () => {
      queueFixtures(callMock, okFixture('r', claudeState))

      await main(['account', 'select', '--agent', 'claude', '--account', 'c1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.selectClaude', { accountId: 'c1' })
      expect(out()).toBe('Managed Claude accounts (1):\n  me@example.com (active)')
    })

    it('goes back to the system default with --account system', async () => {
      queueFixtures(callMock, okFixture('r', { accounts: [], activeAccountId: null }))

      await main(['account', 'select', '--agent', 'codex', '--account', 'system'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.selectCodex', { accountId: null })
    })

    it('selects a Codex account for one WSL distro', async () => {
      queueFixtures(callMock, okFixture('r', { accounts: [], activeAccountId: null }))

      await main(
        ['account', 'select', '--agent', 'codex', '--account', 'x1', '--target', 'wsl:Ubuntu'],
        '/tmp/repo'
      )

      expect(callMock).toHaveBeenCalledWith('accounts.selectCodexForTarget', {
        accountId: 'x1',
        target: { runtime: 'wsl', wslDistro: 'Ubuntu' }
      })
    })

    it('selects an Antigravity account on the host', async () => {
      queueFixtures(callMock, okFixture('r', { accounts: [], activeAccountId: 'a1' }))

      await main(['account', 'select', '--agent', 'antigravity', '--account', 'a1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.antigravitySelect', {
        target: { runtime: 'host' },
        accountId: 'a1'
      })
    })

    it.each([
      ['claude', 'accounts.removeClaude', { accountId: 'c1' }],
      ['codex', 'accounts.removeCodex', { accountId: 'c1' }],
      [
        'antigravity',
        'accounts.antigravityRemove',
        { target: { runtime: 'host' }, accountId: 'c1' }
      ]
    ])('removes a %s account', async (agent, method, params) => {
      queueFixtures(callMock, okFixture('r', { accounts: [], activeAccountId: null }))

      await main(['account', 'rm', '--agent', agent, '--account', 'c1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith(method, params)
      expect(process.exitCode).toBeUndefined()
    })

    it('lists Antigravity accounts and the current sign-in', async () => {
      queueFixtures(
        callMock,
        okFixture('r', {
          accounts: [{ id: 'a1', email: 'ag@example.com', subject: null, authMethod: 'oauth' }],
          activeAccountId: 'a1',
          selectedAccountId: 'a1',
          currentAccount: {
            email: 'ag@example.com',
            subject: null,
            authMethod: 'oauth',
            identityKnown: true
          }
        })
      )

      await main(['account', 'list', '--agent', 'antigravity'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.antigravityList', { runtime: 'host' })
      expect(out()).toBe(
        'Managed Antigravity accounts (1):\n  a1  ag@example.com (active)\nSigned in now: ag@example.com'
      )
    })

    it('adds the Antigravity account that is signed in now', async () => {
      queueFixtures(
        callMock,
        okFixture('r', {
          accounts: [{ id: 'a1', email: 'ag@example.com', subject: null, authMethod: 'oauth' }],
          activeAccountId: 'a1',
          selectedAccountId: 'a1',
          currentAccount: null
        })
      )

      await main(['account', 'add', '--agent', 'antigravity'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledWith('accounts.antigravityAddCurrent', { runtime: 'host' })
      expect(out()).toContain('a1  ag@example.com (active)')
    })

    it('refuses an unknown --target', async () => {
      await main(
        ['account', 'select', '--agent', 'codex', '--account', 'x1', '--target', 'cloud'],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('--target')
      expect(process.exitCode).toBe(1)
    })

    it('spends a Codex reset credit against the scope the host just reported', async () => {
      const limits = {
        provider: 'codex',
        session: null,
        weekly: null,
        error: null,
        status: 'ok',
        updatedAt: 100,
        rateLimitResetCredits: { availableCount: 1, totalEarnedCount: 1, credits: [] }
      }
      queueFixtures(
        callMock,
        okFixture('r1', {
          codex: {
            accounts: [{ id: 'cx1', email: 'me@example.com', updatedAt: 5 }],
            activeAccountId: 'cx1'
          },
          rateLimits: { codex: limits }
        }),
        okFixture('r2', { scope: {}, outcome: 'reset', snapshot: {} })
      )

      await main(['account', 'codex-reset-credit', '--account', 'cx1'], '/tmp/repo')

      expect(callMock).toHaveBeenNthCalledWith(1, 'accounts.list', { refreshUsage: true })
      expect(callMock).toHaveBeenNthCalledWith(2, 'accounts.consumeCodexResetCredit', {
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        expectedScope: {
          target: { runtime: 'host', wslDistro: null },
          accountId: 'cx1',
          accountRevision: 5,
          offerRevision: expect.stringMatching(/^v1:/)
        }
      })
      expect(out()).toBe('Codex reset credit outcome: reset')
    })

    it('refuses to spend a credit when the host offers none for that account', async () => {
      queueFixtures(
        callMock,
        okFixture('r1', {
          codex: { accounts: [{ id: 'cx1', email: 'e', updatedAt: 5 }], activeAccountId: 'cx1' },
          rateLimits: { codex: { provider: 'codex', updatedAt: 1 } }
        })
      )

      await main(['account', 'codex-reset-credit', '--account', 'cx1'], '/tmp/repo')

      expect(callMock).toHaveBeenCalledTimes(1)
      expect(err()).toContain('no reset credit')
      expect(process.exitCode).toBe(1)
    })

    it('rejects --environment for the new account writes too', async () => {
      await main(
        ['account', 'select', '--agent', 'claude', '--account', 'c1', '--environment', 'homelab'],
        '/tmp/repo'
      )

      expect(callMock).not.toHaveBeenCalled()
      expect(err()).toContain('does not retarget')
      expect(process.exitCode).toBe(1)
    })
  })
})
