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
import { OTHER_TEAM, TEAM, roomWith, routeRpcFixtures } from '../bot-teams-test-fixtures'

function printed(): string {
  return String(vi.mocked(console.log).mock.calls[0][0])
}

const SENT = { message: { id: 'msg-3', teamId: 'team-1' }, startError: null }

describe('orca bot-teams send and answer', () => {
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

  it('sends a room message with a reply quote and a file from the team folder', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.postMessage': okFixture('req_post', {
        ...SENT,
        task: { id: 'task-4', title: 'Draft it' }
      })
    })

    await main(
      [
        'bot-teams',
        'send',
        '--team',
        'team-1',
        '--text',
        'Draft it',
        '--reply-to',
        'msg-1',
        '--attach',
        'attachments/brief.pdf'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.postMessage',
      expect.objectContaining({
        teamId: 'team-1',
        text: 'Draft it',
        start: true,
        askProject: true,
        replyToMessageId: 'msg-1',
        attachments: [{ path: 'attachments/brief.pdf', name: 'brief.pdf' }]
      })
    )
    expect(printed()).toBe('Sent message msg-3.\nFiled task task-4 (Draft it) and started it.')
  })

  it('saves a message to Todo with --no-start and sends the prototype count', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.postMessage': okFixture('req_post', {
        ...SENT,
        task: { id: 'task-4', title: 'Build a prototype' }
      })
    })

    await main(
      [
        'bot-teams',
        'send',
        '--team',
        'team-1',
        '--text',
        'Build a prototype',
        '--no-start',
        '--prototypes',
        '3',
        '--design-system',
        'use'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.postMessage',
      expect.objectContaining({
        start: false,
        prototypeChoice: { count: 3, designSystem: 'use' }
      })
    )
    expect(printed()).toBe(
      'Sent message msg-3.\nFiled task task-4 (Build a prototype); it waits in Todo.'
    )
  })

  it('shows the room question and the answer command when the room asks', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.postMessage': okFixture('req_post', {
        ...SENT,
        task: null,
        choice: { kind: 'new-bot' }
      })
    })

    await main(['bot-teams', 'send', '--team', 'team-1', '--text', 'Pay the invoice'], '/tmp/repo')

    expect(printed()).toContain('The room asks before filing: new-bot.')
    expect(printed()).toContain('orca bot-teams answer --team team-1 --request msg-3')
  })

  it('refuses an attachment outside the team folder before calling the host', async () => {
    await main(
      ['bot-teams', 'send', '--team', 'team-1', '--text', 'x', '--attach', '../secret.txt'],
      '/tmp/repo'
    )

    expect(callMock).not.toHaveBeenCalled()
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('attachments/')
    expect(process.exitCode).toBe(1)
  })

  it('refuses a send with no text and no files', async () => {
    await main(['bot-teams', 'send', '--team', 'team-1'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('Missing message text')
  })

  it('answers a choice card with a bot, a project and a prototype count', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.list': okFixture('req_list', { teams: [TEAM] }),
      'botTeams.assignRequest': okFixture('req_assign', {
        task: { id: 'task-5', title: 'Draft the notes' },
        startError: null
      })
    })

    await main(
      [
        'bot-teams',
        'answer',
        '--team',
        'team-1',
        '--request',
        'msg-1',
        '--bot',
        'Pepe',
        '--project',
        'Launch',
        '--prototypes',
        '2'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      expect.objectContaining({
        teamId: 'team-1',
        text: 'Please draft the notes',
        botId: 'bot-2',
        projectId: 'project-1',
        start: true,
        attachments: [{ path: 'attachments/brief.pdf', name: 'brief.pdf' }],
        prototypeChoice: { count: 2 }
      })
    )
    expect(printed()).toBe('Filed task task-5 (Draft the notes) and started it.')
  })

  it('files a choice card to another team with --team-to', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.list': okFixture('req_list', { teams: [TEAM, OTHER_TEAM] }),
      'botTeams.assignRequest': okFixture('req_assign', {
        task: { id: 'task-5', title: 'Draft the notes' },
        startError: null
      })
    })

    await main(
      ['bot-teams', 'answer', '--team', 'team-1', '--request', 'msg-1', '--team-to', 'Ops'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      expect.objectContaining({ toTeamId: 'team-2' })
    )
  })

  it('files a choice card as Todo with --later', async () => {
    routeRpcFixtures(callMock, {
      'botTeams.listRoom': okFixture('req_room', roomWith()),
      'botTeams.assignRequest': okFixture('req_assign', {
        task: { id: 'task-5', title: 'Draft the notes' },
        startError: null
      })
    })

    await main(
      ['bot-teams', 'answer', '--team', 'team-1', '--request', 'msg-1', '--later'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      expect.objectContaining({ later: true, start: true })
    )
    expect(printed()).toBe('Filed task task-5 (Draft the notes); it waits in Todo.')
  })

  it('refuses to answer a message the person did not send', async () => {
    routeRpcFixtures(callMock, { 'botTeams.listRoom': okFixture('req_room', roomWith()) })

    await main(['bot-teams', 'answer', '--team', 'team-1', '--request', 'msg-2'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalledWith('botTeams.assignRequest', expect.anything())
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain('not a request from the person')
  })
})
