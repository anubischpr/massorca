import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeRpcCallError } from './runtime-rpc-result'

const callRuntimeRpc = vi.hoisted(() => vi.fn())
vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc }))
vi.mock('./bot-team-host', () => ({
  botTeamHostTarget: () => ({ kind: 'local' }),
  currentBotTeamHost: () => 'local'
}))

const {
  fileBotTeamRequest,
  listBotTeamFiles,
  listBotTeamRoom,
  postBotTeamRequest,
  readBotTeamFile,
  setBotTeamProjectBrief,
  setBotTeamProjectCodeSource
} = await import('./runtime-bot-team-client')

function failure(code: string): RuntimeRpcCallError {
  return new RuntimeRpcCallError({ id: '1', ok: false, error: { code, message: code } })
}

const PROJECT = { id: 'p1', teamId: 't1', name: 'Website', goal: '' }

describe('connecting a project to code', () => {
  it('asks the host and returns the connected project', async () => {
    callRuntimeRpc.mockResolvedValue({ project: { ...PROJECT, codeSource: 'repo' } })

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).resolves.toMatchObject({
      ...PROJECT,
      codeSource: 'repo'
    })
    expect(callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'local' },
      'botTeams.setProjectCodeSource',
      { projectId: 'p1', codeSource: 'repo' }
    )
  })

  it('reads a host without the method as unavailable, not as a failure', async () => {
    callRuntimeRpc.mockRejectedValue(failure('method_not_found'))

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).resolves.toBe('unavailable')
  })

  it('still reports any other failure', async () => {
    callRuntimeRpc.mockRejectedValue(failure('internal_error'))

    await expect(setBotTeamProjectCodeSource('p1', 'repo')).rejects.toThrow('internal_error')
  })

  it('lists a project from an older host as not connected and without a brief', async () => {
    callRuntimeRpc.mockResolvedValue({ tasks: [], messages: [], projects: [PROJECT] })

    const room = await listBotTeamRoom('t1')

    expect(room.projects).toEqual([
      {
        ...PROJECT,
        codeSource: null,
        brief: { requirements: [], constraints: [], decisions: [] },
        briefUpdatedAt: null
      }
    ])
  })

  it('keeps a brief on the host, and reads a host without the method as unavailable', async () => {
    const brief = { requirements: ['Flyer'], constraints: [], decisions: [] }
    callRuntimeRpc.mockResolvedValue({ project: { ...PROJECT, codeSource: null, brief } })

    await setBotTeamProjectBrief('p1', { goal: 'Sell', brief })
    expect(callRuntimeRpc).toHaveBeenLastCalledWith({ kind: 'local' }, 'botTeams.setProjectBrief', {
      projectId: 'p1',
      goal: 'Sell',
      brief
    })

    callRuntimeRpc.mockRejectedValue(failure('method_not_found'))
    await expect(setBotTeamProjectBrief('p1', { goal: 'Sell', brief })).resolves.toBe('unavailable')
  })
})

describe('the files of a team', () => {
  const LISTED = {
    worktree: 'folder:1',
    rootPath: '/teams/t1',
    files: [{ relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' }],
    totalCount: 1,
    truncated: false
  }

  beforeEach(() => {
    callRuntimeRpc.mockReset()
  })

  it('lists the team folder through the existing file listing of the same host', async () => {
    callRuntimeRpc.mockImplementation(async (_target, method: string) =>
      method === 'botTeams.workspace' ? { workspaceId: 'folder:1' } : LISTED
    )

    await expect(listBotTeamFiles('t1')).resolves.toEqual({
      files: LISTED.files,
      truncated: false
    })
    expect(callRuntimeRpc).toHaveBeenCalledWith({ kind: 'local' }, 'botTeams.workspace', {
      teamId: 't1'
    })
    expect(callRuntimeRpc).toHaveBeenCalledWith({ kind: 'local' }, 'files.list', {
      worktree: 'id:folder:1'
    })
  })

  it('lists nothing, and starts nothing, for a team whose folder does not exist yet', async () => {
    callRuntimeRpc.mockResolvedValue({ workspaceId: null })

    await expect(listBotTeamFiles('t1')).resolves.toEqual({ files: [], truncated: false })
    expect(callRuntimeRpc).toHaveBeenCalledTimes(1)
  })

  it('reads a host without the method as unavailable, not as a failure', async () => {
    callRuntimeRpc.mockRejectedValue(failure('method_not_found'))

    await expect(listBotTeamFiles('t1')).resolves.toBe('unavailable')
  })

  it('still reports any other failure, such as a host out of reach', async () => {
    callRuntimeRpc.mockRejectedValue(failure('runtime_unavailable'))

    await expect(listBotTeamFiles('t1')).rejects.toThrow('runtime_unavailable')
  })

  it('reads one file of the team folder', async () => {
    callRuntimeRpc.mockImplementation(async (_target, method: string) =>
      method === 'botTeams.workspace'
        ? { workspaceId: 'folder:1' }
        : { worktree: 'folder:1', relativePath: 'flyer.html', content: 'hi', truncated: false }
    )

    await expect(readBotTeamFile('t1', 'flyer.html')).resolves.toMatchObject({ content: 'hi' })
    expect(callRuntimeRpc).toHaveBeenCalledWith({ kind: 'local' }, 'files.read', {
      worktree: 'id:folder:1',
      relativePath: 'flyer.html'
    })
  })
})

describe('filing a request the room held', () => {
  it("sends the sender's zone with the answer, so a day it names is read on their clock", async () => {
    callRuntimeRpc.mockResolvedValue({ task: null, startError: null })
    await fileBotTeamRequest({ teamId: 't1', text: 'Escribe el informe para mañana', start: false })
    expect(callRuntimeRpc).toHaveBeenLastCalledWith({ kind: 'local' }, 'botTeams.assignRequest', {
      teamId: 't1',
      text: 'Escribe el informe para mañana',
      start: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  })
})

describe('posting files with no text', () => {
  const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

  it('retries once with the file names when the host still requires text', async () => {
    callRuntimeRpc
      .mockRejectedValueOnce(
        new RuntimeRpcCallError({
          id: '1',
          ok: false,
          error: { code: 'invalid_argument', message: 'Missing message text' }
        })
      )
      .mockResolvedValueOnce({ task: null, startError: null })

    await postBotTeamRequest({ teamId: 't1', text: '', start: true, attachments: [FLYER] })

    expect(callRuntimeRpc).toHaveBeenLastCalledWith({ kind: 'local' }, 'botTeams.postMessage', {
      teamId: 't1',
      text: 'flyer.png',
      start: true,
      attachments: [FLYER],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  })
})
