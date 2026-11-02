import { describe, expect, it, vi } from 'vitest'
import {
  assignMobileBotTeamRequest,
  reassignMobileBotTeamTask
} from './mobile-bot-team-request-rpc'

type HostClient = Parameters<typeof assignMobileBotTeamRequest>[0]

const TASK = {
  id: 'task_1',
  teamId: 'team_2',
  title: 'Inventory',
  prompt: 'Count the stock',
  ownerBotId: 'bot_2',
  sessionId: null,
  projectId: null
}

function clientAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  return { sendRequest, client: { sendRequest } as unknown as HostClient }
}

describe('assignMobileBotTeamRequest', () => {
  it('files the request with the team, and starts it', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { task: TASK, startError: null }
    })
    const filed = await assignMobileBotTeamRequest(client, {
      teamId: 'team_1',
      text: 'Count the stock',
      toTeamId: 'team_2'
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team_1', text: 'Count the stock', toTeamId: 'team_2', start: true },
      expect.anything()
    )
    expect(filed).toEqual({ kind: 'filed', task: TASK, startError: null })
  })

  it('sends no bot or team when the person keeps the request in its team', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { task: TASK, startError: 'No API key' }
    })
    const filed = await assignMobileBotTeamRequest(client, { teamId: 'team_1', text: 'Hi' })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team_1', text: 'Hi', start: true },
      expect.anything()
    )
    expect(filed).toEqual({ kind: 'filed', task: TASK, startError: 'No API key' })
  })

  it('reports a refused request as failed, not as an old host', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'internal', message: 'nope' }
    })
    expect(await assignMobileBotTeamRequest(client, { teamId: 'team_1', text: 'Hi' })).toEqual({
      kind: 'failed'
    })
  })

  it('reports a host without the method as unsupported', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    expect(await assignMobileBotTeamRequest(client, { teamId: 'team_1', text: 'Hi' })).toEqual({
      kind: 'unsupported'
    })
  })

  it('reports a lost connection as failed', async () => {
    const client = {
      sendRequest: async () => {
        throw new Error('socket closed')
      }
    } as unknown as HostClient
    expect(await assignMobileBotTeamRequest(client, { teamId: 'team_1', text: 'Hi' })).toEqual({
      kind: 'failed'
    })
  })

  it('reports the project question as asked, with nothing filed yet', async () => {
    const { client } = clientAnswering({
      ok: true,
      result: { task: null, startError: null, choice: { kind: 'project', botId: 'bot_2' } }
    })
    expect(
      await assignMobileBotTeamRequest(client, {
        teamId: 'team_1',
        text: 'Hi',
        askProject: true,
        botId: 'bot_2'
      })
    ).toEqual({ kind: 'asked', choice: { kind: 'project', botId: 'bot_2' } })
  })

  it('files with the project, the other bots and the later flag the person answered with', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { task: TASK, startError: null }
    })
    await assignMobileBotTeamRequest(client, {
      teamId: 'team_1',
      text: 'Hi',
      askProject: true,
      botId: 'bot_2',
      projectId: 'project_1',
      alsoNeeds: ['bot_3'],
      later: true
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      {
        teamId: 'team_1',
        text: 'Hi',
        askProject: true,
        botId: 'bot_2',
        projectId: 'project_1',
        alsoNeeds: ['bot_3'],
        later: true,
        start: true
      },
      expect.anything()
    )
  })
})

describe('reassignMobileBotTeamTask', () => {
  it('gives the task to the bot and starts it fresh', async () => {
    const { client, sendRequest } = clientAnswering({
      ok: true,
      result: { task: { ...TASK, ownerBotId: 'bot_9' }, startError: null }
    })
    const moved = await reassignMobileBotTeamTask(client, { taskId: 'task_1', botId: 'bot_9' })
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.reassignTask',
      { taskId: 'task_1', botId: 'bot_9' },
      expect.anything()
    )
    expect(moved).toEqual({
      kind: 'filed',
      task: { ...TASK, ownerBotId: 'bot_9' },
      startError: null
    })
  })

  it('reports a host without the method as unsupported, not as a lost connection', async () => {
    const { client } = clientAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    expect(await reassignMobileBotTeamTask(client, { taskId: 'task_1', botId: 'bot_9' })).toEqual({
      kind: 'unsupported'
    })
  })
})
