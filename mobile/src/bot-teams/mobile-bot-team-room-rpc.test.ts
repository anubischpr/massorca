import { describe, expect, it, vi } from 'vitest'
import {
  createMobileBotProject,
  listMobileBotTeamRoom,
  setMobileBotProjectCodeSource
} from './mobile-bot-team-room-rpc'

type HostClient = Parameters<typeof listMobileBotTeamRoom>[0]

const PROJECT = {
  id: 'project_1',
  teamId: 'team_1',
  name: 'Launch',
  goal: 'Ship the flyer',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  return { sendRequest, client: { sendRequest } as unknown as HostClient }
}

describe('listMobileBotTeamRoom', () => {
  it('reads the projects the room lists', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { tasks: [], messages: [], projects: [PROJECT], workspaceId: null }
    })
    expect(await listMobileBotTeamRoom(client, 'team_1')).toMatchObject({ projects: [PROJECT] })
  })

  it('reads a host from before projects existed as having none', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { tasks: [], messages: [], workspaceId: null }
    })
    expect(await listMobileBotTeamRoom(client, 'team_1')).toMatchObject({ projects: [] })
  })
})

describe('createMobileBotProject', () => {
  it('creates the project with its source and returns it', async () => {
    const { client, sendRequest } = clientAnswering({ ok: true, result: { project: PROJECT } })
    const result = await createMobileBotProject(client, {
      teamId: 'team_1',
      name: 'Launch',
      goal: 'Ship the flyer',
      codeSource: 'repo'
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.createProject',
      { teamId: 'team_1', name: 'Launch', goal: 'Ship the flyer', codeSource: 'repo' },
      expect.anything()
    )
    expect(result).toEqual({ kind: 'ok', project: PROJECT })
  })

  it('treats a host without the method as unsupported', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    expect(
      await createMobileBotProject(client, {
        teamId: 'team_1',
        name: 'Launch',
        goal: '',
        codeSource: null
      })
    ).toEqual({ kind: 'unsupported' })
  })

  it('reports a lost connection as failed', async () => {
    const client = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    } as unknown as HostClient
    expect(
      await createMobileBotProject(client, {
        teamId: 'team_1',
        name: 'Launch',
        goal: '',
        codeSource: null
      })
    ).toEqual({ kind: 'failed' })
  })
})

describe('setMobileBotProjectCodeSource', () => {
  it('records the chosen source on the project', async () => {
    const connected = { ...PROJECT, codeSource: 'folder' as const }
    const { client, sendRequest } = clientAnswering({ ok: true, result: { project: connected } })
    const result = await setMobileBotProjectCodeSource(client, 'project_1', 'folder')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.setProjectCodeSource',
      { projectId: 'project_1', codeSource: 'folder' },
      expect.anything()
    )
    expect(result).toEqual({ kind: 'ok', project: connected })
  })
})
