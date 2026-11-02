import { describe, expect, it, vi } from 'vitest'
import {
  archiveMobileBotProject,
  deleteMobileBotProject,
  updateMobileBotProject
} from './mobile-bot-team-project-rpc'

type HostClient = Parameters<typeof updateMobileBotProject>[0]

const PROJECT = {
  id: 'project_1',
  teamId: 'team_1',
  name: 'NexusCare',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null,
  archivedAt: null,
  linkedTeamIds: []
}

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  return { sendRequest, client: { sendRequest } as unknown as HostClient }
}

describe('updateMobileBotProject', () => {
  it('sends the acting team and the new teams, and returns the saved project', async () => {
    const { client, sendRequest } = clientAnswering({ ok: true, result: { project: PROJECT } })
    const result = await updateMobileBotProject(client, {
      projectId: 'project_1',
      teamId: 'team_1',
      name: 'NexusCare',
      linkedTeamIds: ['team_2']
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.updateProject',
      { projectId: 'project_1', teamId: 'team_1', name: 'NexusCare', linkedTeamIds: ['team_2'] },
      expect.anything()
    )
    expect(result).toEqual({ kind: 'ok', project: expect.objectContaining({ id: 'project_1' }) })
  })

  it('says an older host cannot, rather than failing', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'method_not_found' }
    })
    expect(await updateMobileBotProject(client, { projectId: 'p', teamId: 't' })).toEqual({
      kind: 'unsupported'
    })
  })
})

describe('archiveMobileBotProject and deleteMobileBotProject', () => {
  it('archives and restores as the acting team', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { project: { ...PROJECT, archivedAt: 5 } }
    })
    const result = await archiveMobileBotProject(client, {
      projectId: 'project_1',
      teamId: 'team_1',
      archived: true
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.archiveProject',
      { projectId: 'project_1', teamId: 'team_1', archived: true },
      expect.anything()
    )
    expect(result).toMatchObject({ kind: 'ok', project: { archivedAt: 5 } })
  })

  it('passes the host’s refusal on in its own words', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: {
        code: 'internal_error',
        message: 'Only the team that owns NexusCare can delete it.'
      }
    })
    expect(await deleteMobileBotProject(client, { projectId: 'p', teamId: 't2' })).toEqual({
      kind: 'refused',
      message: 'Only the team that owns NexusCare can delete it.'
    })
  })

  it('reports a deletion', async () => {
    const { client, sendRequest } = clientAnswering({ ok: true, result: { deleted: true } })
    expect(await deleteMobileBotProject(client, { projectId: 'p', teamId: 't' })).toEqual({
      kind: 'deleted'
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.deleteProject',
      { projectId: 'p', teamId: 't' },
      expect.anything()
    )
  })
})
