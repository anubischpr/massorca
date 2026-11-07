import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', async () => {
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture } from '../test-fixtures'
import { BOTS, TEAM, routeRpcFixtures } from '../bot-teams-test-fixtures'

const TEAM_LIST = okFixture('req_list', { teams: [TEAM] })
const WEBHOOK_HOOK = { id: 'hook-2', teamId: 'team-1', botId: 'bot-1', lastCall: null }
const READY = { state: 'ready', baseUrl: 'http://127.0.0.1:4567' }

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

describe('orca bot-teams team, bot, memory, web address and file writes', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.env = { ...originalEnv }
    delete process.env.ORCA_WORKTREE_ID
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('creates a team with the workspace option on', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.create': okFixture('req_create', {
        team: { ...TEAM, id: 'team-2', name: 'Research' }
      })
    })

    await main(
      [
        'bot-teams',
        'team',
        'create',
        '--name',
        'Research',
        '--character',
        'hexagon',
        '--purpose',
        'Explore',
        '--workspaces',
        'on'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.create',
      expect.objectContaining({
        name: 'Research',
        purpose: 'Explore',
        character: 'hexagon',
        workspacesEnabled: true
      })
    )
    expect(printed()).toBe('Created team Research (team-2).')
  })

  it('updates only the team fields it is given', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.update': okFixture('req_update', {
        team: { ...TEAM, purpose: 'Support customers', accessMode: 'full-access' }
      })
    })

    await main(
      [
        'bot-teams',
        'team',
        'update',
        '--team',
        'team-1',
        '--purpose',
        'Support customers',
        '--access-mode',
        'full-access'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.update', {
      teamId: 'team-1',
      purpose: 'Support customers',
      accessMode: 'full-access'
    })
    expect(printed()).toBe('Updated team Support (team-1).')
  })

  it('deletes a team by id', async () => {
    routeRpcFixtures(callMock, { 'botTeams.delete': okFixture('req_delete', { deleted: true }) })

    await main(['bot-teams', 'team', 'rm', '--team', 'team-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.delete', { teamId: 'team-1' })
    expect(printed()).toBe('Deleted team team-1.')
  })

  it('adds a bot to a team', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.addBot': okFixture('req_add', {
        team: { ...TEAM, bots: [...BOTS, { ...BOTS[0], id: 'bot-9', name: 'Lupe' }] }
      })
    })

    await main(
      [
        'bot-teams',
        'bot',
        'add',
        '--team',
        'team-1',
        '--name',
        'Lupe',
        '--agent',
        'claude',
        '--job',
        'Writes copy'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.addBot', {
      teamId: 'team-1',
      bot: { name: 'Lupe', agent: 'claude', job: 'Writes copy' }
    })
    expect(printed()).toBe('Added bot Lupe to Support.')
  })

  it('updates a bot by name and keeps the fields it was not given', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': TEAM_LIST,
      'botTeams.updateBot': okFixture('req_update_bot', { team: TEAM })
    })

    await main(
      [
        'bot-teams',
        'bot',
        'update',
        '--team',
        'team-1',
        '--bot',
        'Estrellita',
        '--job',
        'Leads support',
        '--model',
        'opus'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.updateBot', {
      teamId: 'team-1',
      botId: 'bot-1',
      bot: {
        name: 'Estrellita',
        job: 'Leads support',
        agent: 'claude',
        modelMode: 'auto',
        model: 'opus',
        effort: null,
        skills: []
      }
    })
    expect(printed()).toBe('Updated bot Estrellita on Support.')
  })

  it('removes a bot by name', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': TEAM_LIST,
      'botTeams.removeBot': okFixture('req_remove', { team: { ...TEAM, bots: [BOTS[0]] } })
    })

    await main(['bot-teams', 'bot', 'rm', '--team', 'team-1', '--bot', 'Pepe'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.removeBot', {
      teamId: 'team-1',
      botId: 'bot-2'
    })
    expect(printed()).toBe('Removed Pepe from Support.')
  })

  it('lists team memory with the bot each line belongs to', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': TEAM_LIST,
      'botTeams.listMemory': okFixture('req_memory', {
        memory: [
          {
            id: 'mem-1',
            teamId: 'team-1',
            botId: null,
            text: 'Use metric units',
            source: { kind: 'person', taskTitle: null }
          },
          {
            id: 'mem-2',
            teamId: 'team-1',
            botId: 'bot-1',
            text: 'Prefers short notes',
            source: { kind: 'task', taskTitle: 'Draft the notes' }
          }
        ]
      })
    })

    await main(['bot-teams', 'memory', 'list', '--team', 'team-1'], '/tmp/repo')

    expect(printed()).toBe(
      'mem-1  whole team  Use metric units\nmem-2  Estrellita  Prefers short notes'
    )
  })

  it('deletes one memory line by id', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.deleteMemory': okFixture('req_forget', { deleted: true })
    })

    await main(['bot-teams', 'memory', 'rm', '--memory', 'mem-1'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.deleteMemory', { memoryId: 'mem-1' })
    expect(printed()).toBe('Deleted memory mem-1.')
  })

  it('lists web addresses with their bot and the host endpoint', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': TEAM_LIST,
      'botTeams.listWebhooks': okFixture('req_hooks', {
        webhooks: [{ id: 'hook-1', teamId: 'team-1', botId: 'bot-1', lastCall: null }],
        endpoint: READY
      })
    })

    await main(['bot-teams', 'webhook', 'list', '--team', 'team-1'], '/tmp/repo')

    expect(printed()).toBe('hook-1  Estrellita  never called\nEndpoint: http://127.0.0.1:4567')
  })

  it('creates a web address and prints its secret once', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.list': TEAM_LIST,
      'botTeams.createWebhook': okFixture('req_hook', {
        webhook: WEBHOOK_HOOK,
        secret: 'whk_s3cret',
        endpoint: READY
      })
    })

    await main(
      ['bot-teams', 'webhook', 'create', '--team', 'team-1', '--bot', 'Estrellita'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.createWebhook', {
      teamId: 'team-1',
      botId: 'bot-1'
    })
    expect(printed()).toContain('Secret (shown once, store it now): whk_s3cret')
  })

  it('rotates the secret of a web address and prints the new one once', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.replaceWebhookSecret': okFixture('req_rotate', {
        webhook: WEBHOOK_HOOK,
        secret: 'whk_new',
        endpoint: { state: 'unavailable' }
      })
    })

    await main(['bot-teams', 'webhook', 'rotate-secret', '--webhook', 'hook-2'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('botTeams.replaceWebhookSecret', { webhookId: 'hook-2' })
    expect(printed()).toContain('Secret (shown once, store it now): whk_new')
    expect(printed()).toContain('Endpoint: unavailable on this host.')
  })

  it('lists saved versions of a team file', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.fileVersions': okFixture('req_versions', {
        versions: [
          {
            version: { id: '3', label: 'Draft the notes', reason: 'task-finished' },
            deleted: false
          }
        ]
      })
    })

    await main(
      ['bot-teams', 'file', 'versions', '--team', 'team-1', '--path', 'flyer.html'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.fileVersions', {
      teamId: 'team-1',
      relativePath: 'flyer.html'
    })
    expect(printed()).toBe('3  Draft the notes  task-finished')
  })

  it('puts a file back to a saved version', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.restoreFileVersion': okFixture('req_restore', {
        result: { ok: true, restoredFrom: { id: '3' }, savedBefore: null }
      })
    })

    await main(
      [
        'bot-teams',
        'file',
        'restore-version',
        '--team',
        'team-1',
        '--path',
        'flyer.html',
        '--version',
        '3'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('botTeams.restoreFileVersion', {
      teamId: 'team-1',
      versionId: '3',
      relativePath: 'flyer.html'
    })
    expect(printed()).toBe('Restored flyer.html to version 3.')
  })

  it('exits 1 with the host reason when a version cannot be restored', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.restoreFileVersion': okFixture('req_restore', {
        result: { ok: false, reason: 'missing-version', message: 'That version no longer exists.' }
      })
    })

    await main(
      [
        'bot-teams',
        'file',
        'restore-version',
        '--team',
        'team-1',
        '--path',
        'flyer.html',
        '--version',
        '9'
      ],
      '/tmp/repo'
    )

    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('no longer exists')
    expect(process.exitCode).toBe(1)
  })
})
