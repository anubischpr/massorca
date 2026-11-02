import { describe, expect, it, vi } from 'vitest'
import {
  createMobileBotProject,
  listMobileBotLinkableWorkspaces,
  listMobileBotTeamRoom,
  postMobileBotTeamRequest,
  setMobileBotProjectCodeSource,
  setMobileBotProjectWorkspace
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

  it('asks for shared and archived projects only when told to, and reads the tasks of other teams', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: {
        tasks: [],
        messages: [],
        projects: [{ ...PROJECT, archivedAt: 5, linkedTeamIds: ['team_2'] }],
        projectTasks: [
          {
            id: 'k2',
            teamId: 'team_2',
            title: 'Launch email',
            prompt: '',
            ownerBotId: 'b2',
            sessionId: null,
            projectId: 'project_1'
          }
        ],
        workspaceId: null
      }
    })

    const room = await listMobileBotTeamRoom(client, 'team_1', { withLinkedProjects: true })

    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.listRoom',
      { teamId: 'team_1', withLinkedProjects: true },
      expect.anything()
    )
    expect(room?.projects[0]).toMatchObject({ archivedAt: 5, linkedTeamIds: ['team_2'] })
    expect(room?.projectTasks.map((task) => task.id)).toEqual(['k2'])
  })

  it('sends nothing new to a host when not asked, and reads no other team’s tasks then', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { tasks: [], messages: [], projects: [PROJECT], workspaceId: null }
    })
    const room = await listMobileBotTeamRoom(client, 'team_1')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.listRoom',
      { teamId: 'team_1' },
      expect.anything()
    )
    expect(room?.projectTasks).toEqual([])
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

describe('postMobileBotTeamRequest', () => {
  const POST = { teamId: 'team_1', text: 'Hi', start: true }

  it('reads the project question the host asks, with the bot it is asked of', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: {
        task: null,
        startError: null,
        choice: { kind: 'project', botId: 'bot_2', alsoNeeds: ['bot_3'] }
      }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toMatchObject({
      ok: true,
      choice: { kind: 'project', botId: 'bot_2', alsoNeeds: ['bot_3'] }
    })
  })

  it('keeps the bot the host suggests for a new bot', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { task: null, startError: null, choice: { kind: 'new-bot', suggestedBotId: 'bot_2' } }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toMatchObject({
      ok: true,
      choice: { kind: 'new-bot', suggestedBotId: 'bot_2' }
    })
  })

  it('reads that the person asked for the work later', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { task: null, startError: null, later: true, choice: { kind: 'new-team' } }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toMatchObject({ ok: true, later: true })
  })

  it('reads the choice, composite, answered and sent-to fields the host adds', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: {
        task: null,
        startError: null,
        choice: { kind: 'other-team', teamId: 'team_2' },
        composite: ['Max'],
        answered: false,
        sentTo: null
      }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toEqual({
      ok: true,
      task: null,
      startError: null,
      greeted: false,
      choice: { kind: 'other-team', teamId: 'team_2' },
      composite: ['Max'],
      answered: false,
      sentTo: null,
      later: false
    })
  })

  it('reads a sent-to team and a bot-less answer', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: {
        task: null,
        startError: null,
        answered: true,
        sentTo: { teamId: 'team_2', teamName: 'Warehouse' }
      }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toMatchObject({
      ok: true,
      answered: true,
      sentTo: { teamId: 'team_2', teamName: 'Warehouse' }
    })
  })

  it('reads an older host that sends none of the fields as nothing decided', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { task: null, startError: null }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toEqual({
      ok: true,
      task: null,
      startError: null,
      greeted: false,
      choice: null,
      composite: [],
      answered: false,
      sentTo: null,
      later: false
    })
  })

  it('reports a choice it cannot read as not sent', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { task: null, startError: null, choice: { kind: 'elsewhere' } }
    })
    expect(await postMobileBotTeamRequest(client, POST)).toEqual({ ok: false })
  })
})

describe('listMobileBotLinkableWorkspaces', () => {
  it('reads the workspaces the team’s host lists', async () => {
    const workspaces = [{ key: 'folder:fw-1', name: 'Notes', kind: 'folder' }]
    const { client } = clientAnswering({ ok: true, result: { workspaces } })
    expect(await listMobileBotLinkableWorkspaces(client, 'team_1')).toEqual({
      kind: 'ok',
      workspaces
    })
  })

  it('reports an older host as unsupported rather than failing', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'Unknown method botTeams.listLinkableWorkspaces' }
    })
    expect(await listMobileBotLinkableWorkspaces(client, 'team_1')).toEqual({ kind: 'unsupported' })
  })

  it('reports a list it cannot read as failed', async () => {
    const { client } = clientAnswering({ ok: true, result: { workspaces: [{ key: 1 }] } })
    expect(await listMobileBotLinkableWorkspaces(client, 'team_1')).toEqual({ kind: 'failed' })
  })
})

describe('setMobileBotProjectWorkspace', () => {
  it('links the project and returns it with its workspace', async () => {
    const linked = { ...PROJECT, workspace: { key: 'folder:fw-1', name: 'Notes' } }
    const { client, sendRequest } = clientAnswering({ ok: true, result: { project: linked } })
    expect(await setMobileBotProjectWorkspace(client, 'project_1', 'folder:fw-1')).toEqual({
      kind: 'ok',
      project: linked
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.setProjectWorkspace',
      { projectId: 'project_1', workspaceKey: 'folder:fw-1' },
      expect.anything()
    )
  })

  it('shows the host’s refusal, such as Workspaces being off, as its own sentence', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: {
        code: 'invalid_params',
        message: 'Turn on Workspaces for Marketing to link a Workspaces project.'
      }
    })
    expect(await setMobileBotProjectWorkspace(client, 'project_1', 'folder:fw-1')).toEqual({
      kind: 'refused',
      message: 'Turn on Workspaces for Marketing to link a Workspaces project.'
    })
  })

  it('reports an older host as unsupported', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'Unknown method botTeams.setProjectWorkspace' }
    })
    expect(await setMobileBotProjectWorkspace(client, 'project_1', null)).toEqual({
      kind: 'unsupported'
    })
  })
})
