import { describe, expect, it, vi } from 'vitest'
import { startBotTeamTask, type BotTeamTaskStartDeps } from './bot-team-task-start'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'

const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    {
      id: 'bot',
      name: 'Iris',
      job: 'Designs flyers',
      agent: 'codex',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}
const TASK: BotTeamTask = {
  id: 'task',
  teamId: 'team',
  title: 'Flyer',
  prompt: 'Design the flyer',
  ownerBotId: 'bot',
  sessionId: null,
  projectId: null
}

function deps(overrides: Partial<BotTeamTaskStartDeps> = {}): BotTeamTaskStartDeps {
  return {
    ensureTeamWorkspace: vi.fn(async () => 'folder:1'),
    createSession: vi.fn(async () => 'session-1'),
    sendPrompt: vi.fn(async () => true),
    linkSession: vi.fn((_taskId, sessionId) => ({ ...TASK, sessionId })),
    ...overrides
  }
}

const PROJECT: BotTeamProject = {
  id: 'project',
  teamId: 'team',
  name: 'Summer campaign',
  goal: 'Sell the offers',
  codeSource: null,
  brief: {
    requirements: ['Flyer for the offers', 'Offer email'],
    constraints: ['Prices are checked first'],
    decisions: []
  },
  briefUpdatedAt: 1
}

describe('startBotTeamTask', () => {
  it('gives the bot the brief of the task project, without empty sections', async () => {
    const d = deps()
    await startBotTeamTask(d, {
      team: TEAM,
      task: { ...TASK, projectId: 'project' },
      project: PROJECT
    })

    const prompt = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(prompt).toContain('Summer campaign')
    expect(prompt).toContain('Goal: Sell the offers')
    expect(prompt).toContain('Requirements:\n- Flyer for the offers\n- Offer email')
    expect(prompt).toContain('Constraints:\n- Prices are checked first')
    expect(prompt).not.toContain('Decisions:')
    expect(prompt.indexOf('Summer campaign')).toBeLessThan(prompt.indexOf('Design the flyer'))
  })

  it('adds nothing for a task without a project', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: TASK })

    expect(vi.mocked(d.sendPrompt).mock.calls[0][1]).not.toContain('Goal:')
  })

  it("starts with the bot's model and asks it to use its skills", async () => {
    const d = deps()
    const bot = { ...TEAM.bots[0], model: 'gpt-6.1-sol', effort: 'high', skills: ['PDF', 'Brand'] }
    await startBotTeamTask(d, { team: { ...TEAM, bots: [bot] }, task: TASK })

    expect(d.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ options: { model: 'gpt-6.1-sol', effort: 'high' } })
    )
    expect(vi.mocked(d.sendPrompt).mock.calls[0][1]).toContain(
      'Use these skills when they fit: PDF, Brand.'
    )
  })

  it("runs on the owner's engine with the team's access, in the team's workspace", async () => {
    const d = deps()
    const started = await startBotTeamTask(d, { team: TEAM, task: TASK })

    expect(d.createSession).toHaveBeenCalledWith({
      workspaceId: 'folder:1',
      agent: 'codex',
      accessMode: 'full-access'
    })
    expect(started.sessionId).toBe('session-1')
  })

  it('tells the bot who it is and what to do', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: TASK })

    const text = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(text).toContain('Iris')
    expect(text).toContain('Designs flyers')
    expect(text).toContain('Design the flyer')
  })

  it('hands the bot the notes saved for its start, after the request', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: TASK, notes: "It was Max's before." })

    const text = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(text).toContain("It was Max's before.")
    expect(text.indexOf('Design the flyer')).toBeLessThan(text.indexOf("It was Max's before."))
  })

  it('adds nothing when there are no notes', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: TASK, notes: null })
    expect(vi.mocked(d.sendPrompt).mock.calls[0][1]).not.toContain('reassigned')
  })

  it('uses the title when the task has no prompt', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: { ...TASK, prompt: '' } })

    expect(vi.mocked(d.sendPrompt).mock.calls[0][1]).toContain('Flyer')
  })

  it('links the session only after the request is delivered', async () => {
    const order: string[] = []
    const d = deps({
      linkSession: vi.fn((_taskId, sessionId) => {
        order.push('link')
        return { ...TASK, sessionId }
      }),
      sendPrompt: vi.fn(async () => {
        order.push('send')
        return true
      })
    })
    await startBotTeamTask(d, { team: TEAM, task: TASK })

    expect(order).toEqual(['send', 'link'])
  })

  it('keeps the task in Todo and reports it when the request is not delivered', async () => {
    const d = deps({ sendPrompt: vi.fn(async () => false) })

    await expect(startBotTeamTask(d, { team: TEAM, task: TASK })).rejects.toThrow(
      'did not reach the bot'
    )
    expect(d.linkSession).not.toHaveBeenCalled()
  })

  it('refuses a task that already started, and creates nothing', async () => {
    const d = deps()
    await expect(
      startBotTeamTask(d, { team: TEAM, task: { ...TASK, sessionId: 'old' } })
    ).rejects.toThrow('already started')
    expect(d.createSession).not.toHaveBeenCalled()
  })

  it('leaves the task in Todo when the session cannot be created', async () => {
    const d = deps({
      createSession: vi.fn(async () => {
        throw new Error('no agent')
      })
    })
    await expect(startBotTeamTask(d, { team: TEAM, task: TASK })).rejects.toThrow('no agent')
    expect(d.linkSession).not.toHaveBeenCalled()
  })

  it('refuses a task whose owner left the team', async () => {
    const d = deps()
    await expect(startBotTeamTask(d, { team: { ...TEAM, bots: [] }, task: TASK })).rejects.toThrow(
      'no longer on'
    )
    expect(d.createSession).not.toHaveBeenCalled()
  })
})
