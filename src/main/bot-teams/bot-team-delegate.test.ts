import { describe, expect, it, vi } from 'vitest'
import {
  delegateToBotTeammate,
  findDelegationTeam,
  type BotTeamDelegateDeps
} from './bot-team-delegate'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../shared/rpc-contract/bot-team-room-params'

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
  it('hands the same text to the same teammate once and says it was already handed over', async () => {
    const existing = {
      id: 'task-1',
      teamId: 'team',
      sessionId: null,
      title: 'Part',
      prompt: 'x',
      ownerBotId: 'max',
      projectId: null
    }
    const d = deps({ alreadyHandedOver: vi.fn(() => existing) })

    const task = await delegateToBotTeammate(d, {
      team: TEAM,
      botName: 'Max',
      text: 'Review the API'
    })

    expect(task).toMatchObject({ id: 'task-1', alreadyHandedOver: true })
    expect(d.alreadyHandedOver).toHaveBeenCalledWith('max', 'Review the API')
    expect(d.fileRequest).not.toHaveBeenCalled()
    expect(d.createTask).not.toHaveBeenCalled()
  })

  it('runs a teammate on Gentle Shell as Gentle Shell, never as stock Pi', async () => {
    const d = deps()
    const shell = { ...TEAM.bots[0], name: 'Rosa', agent: 'pi' as const }
    await delegateToBotTeammate(d, {
      team: { ...TEAM, bots: [shell] },
      botName: 'Rosa',
      text: 'Write the file'
    })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].piRuntime).toBe('gentle-shell')
  })

  it('gives the teammate the project brief the caller works under', async () => {
    const d = deps()
    await delegateToBotTeammate(d, {
      team: TEAM,
      botName: 'Max',
      text: 'Write the file',
      project: {
        id: 'p1',
        teamId: 'team',
        name: 'Summer',
        goal: 'Sell more ice cream',
        codeSource: null,
        brief: { requirements: ['Flyers in two colors'], constraints: [], decisions: [] },
        briefUpdatedAt: null
      }
    })
    const prompt = vi.mocked(d.fileRequest).mock.calls[0][0].prompt
    expect(prompt).toContain('Summer')
    expect(prompt).toContain('Goal: Sell more ice cream')
    expect(prompt).toContain('- Flyers in two colors')
  })

  it('adds no Marketplace line for an app the teammate is kept out of', async () => {
    const d = deps()
    await delegateToBotTeammate(d, {
      team: TEAM,
      botName: 'Max',
      text: 'Ask @Engram and @GitHub',
      deniedMarketplaceApps: ['engram']
    })
    const prompt = vi.mocked(d.fileRequest).mock.calls[0][0].prompt
    expect(prompt).not.toContain('MCP server engram')
    expect(prompt).toContain('Use GitHub (the gh command) for this request.')
  })

  describe('the folder a child writes in', () => {
    const LINKED: BotTeamProject = {
      id: 'p1',
      teamId: 'team',
      name: 'NexusCare',
      goal: '',
      codeSource: null,
      brief: { requirements: ['Audit the intake flow'], constraints: [], decisions: [] },
      briefUpdatedAt: null,
      workspace: { key: 'repo:nexuscare', name: 'NexusCare' }
    }
    const PAIR: BotTeam = {
      ...TEAM,
      bots: [TEAM.bots[0], { ...TEAM.bots[0], id: 'rosa', name: 'Rosa', agent: 'pi' }]
    }

    it.each(['Max', 'Rosa'])(
      '%s, on any agent, is told to write where its child starts, not in the project workspace',
      async (botName) => {
        const d = deps()
        await delegateToBotTeammate(d, {
          team: PAIR,
          botName,
          text: 'Write the audit files',
          project: LINKED
        })
        const prompt = vi.mocked(d.fileRequest).mock.calls[0][0].prompt
        expect(prompt).toContain('- Audit the intake flow')
        expect(prompt).not.toContain("this project's workspace")
        expect(prompt).toContain('current working directory')
      }
    )
  })

  it('gives the teammate what the team and the teammate remember', async () => {
    const d = deps({
      memoryFor: vi.fn(() => ({ team: ['Closed on Monday.'], bot: ['Short sentences.'] }))
    })
    await delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Write the file' })
    expect(d.memoryFor).toHaveBeenCalledWith('max')
    const prompt = vi.mocked(d.fileRequest).mock.calls[0][0].prompt
    expect(prompt).toContain('- Closed on Monday.')
    expect(prompt).toContain('What Max remembers')
  })

  it('names no brief when the caller has no project', async () => {
    const d = deps()
    await delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Write the file' })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].prompt).not.toContain('part of the project')
  })

  it('names no Pi runtime for any other agent', async () => {
    const d = deps()
    await delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Write the file' })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].piRuntime).toBeUndefined()
  })

  it('files no model for Gentle Shell, which runs the one from its own config', async () => {
    const d = deps()
    const shell = {
      ...TEAM.bots[0],
      name: 'Rosa',
      agent: 'pi' as const,
      model: 'nan/deepseek-v4-flash'
    }
    await delegateToBotTeammate(d, { team: { ...TEAM, bots: [shell] }, botName: 'Rosa', text: 'x' })
    expect(vi.mocked(d.fileRequest).mock.calls[0][0].launch).toBeUndefined()
  })

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

  it('tells the caller when the teammate did not start, so it never says the work was handed over', async () => {
    const d = deps({
      launchOutcome: vi.fn(async () => ({
        failed: 'Agent pi does not support launch-time model selection.'
      }))
    })
    await expect(
      delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Do it' })
    ).rejects.toThrow(/Max did not start .*launch-time model selection.*Not started/s)
  })

  it('returns the task when the launch outcome is a start', async () => {
    const d = deps({ launchOutcome: vi.fn(async () => ({ failed: null })) })
    const task = await delegateToBotTeammate(d, { team: TEAM, botName: 'Max', text: 'Do it' })
    expect(task.ownerBotId).toBe('max')
  })

  it('refuses a bot that is not on the team, with no effects', async () => {
    const d = deps()

    await expect(
      delegateToBotTeammate(d, { team: TEAM, botName: 'Ghost', text: 'Do it' })
    ).rejects.toThrow('not on this team')
    expect(d.fileRequest).not.toHaveBeenCalled()
  })
})

describe('findDelegationTeam', () => {
  const warehouse: BotTeam = { ...TEAM, id: 'wh', name: 'Warehouse' }

  it('is the caller team unless another team is named, in any case', () => {
    expect(findDelegationTeam([TEAM, warehouse], 'team')).toBe(TEAM)
    expect(findDelegationTeam([TEAM, warehouse], 'team', 'warehouse')).toBe(warehouse)
  })

  it('refuses a team that does not exist, saying nothing was changed', () => {
    expect(() => findDelegationTeam([TEAM], 'team', 'Ghost')).toThrow(
      'Ghost is not a team here. No effects were applied.'
    )
    expect(() => findDelegationTeam([], 'team')).toThrow('This team no longer exists.')
  })
})
