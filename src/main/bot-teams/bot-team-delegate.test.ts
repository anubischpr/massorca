import { describe, expect, it, vi } from 'vitest'
import { delegateToBotTeammate, type BotTeamDelegateDeps } from './bot-team-delegate'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'

const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    {
      id: 'max',
      name: 'Max',
      job: 'Writes files',
      agent: 'codex',
      modelMode: 'manual',
      model: 'gpt-6-astra',
      effort: 'high',
      skills: []
    }
  ]
}

function deps(overrides: Partial<BotTeamDelegateDeps> = {}): BotTeamDelegateDeps {
  return {
    fileRequest: vi.fn(async () => 'request-1'),
    createTask: vi.fn((args) => ({ id: 'task', teamId: 'team', sessionId: null, ...args })),
    linkTask: vi.fn(),
    startRequest: vi.fn(),
    ...overrides
  }
}

describe('delegateToBotTeammate', () => {
  it("files the child with the teammate's own model", async () => {
    const d = deps()
    await delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Write the file' })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].launch).toEqual({
      model: 'gpt-6-astra',
      effort: 'high'
    })
  })

  it("files the request on the teammate's engine, then links and starts its task", async () => {
    const d = deps()
    const task = await delegateToBotTeammate(d, { team: TEAM, botName: 'max', text: 'Do it' })

    expect(vi.mocked(d.fileRequest).mock.calls[0][0]).toMatchObject({ agent: 'codex' })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].prompt).toContain('You are Max')
    expect(task.ownerBotId).toBe('max')
    expect(d.linkTask).toHaveBeenCalledWith('task', 'request-1')
    expect(d.startRequest).toHaveBeenCalledWith('request-1', 'codex')
  })

  it('creates no task when the request is refused, so a retry adds nothing', async () => {
    const d = deps({
      fileRequest: vi.fn(async () => {
        throw new Error('codex cannot run a chat')
      })
    })

    await expect(
      delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Do it' })
    ).rejects.toThrow('cannot run a chat')
    expect(d.createTask).not.toHaveBeenCalled()
  })

  it('refuses a bot that is not on the team, with no effects', async () => {
    const d = deps()

    await expect(
      delegateToBotTeammate(d, { team: TEAM, botName: 'Ghost', text: 'Do it' })
    ).rejects.toThrow('not on this team')
    expect(d.fileRequest).not.toHaveBeenCalled()
  })
})
