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
    prepareLinkedWorkspace: vi.fn(async () => 'repo-1::/work/nexus-task'),
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

  it('hands the bot what the team and the bot remember, and how to keep more', async () => {
    const d = deps()
    await startBotTeamTask(d, {
      team: TEAM,
      task: TASK,
      memory: { team: ['Offices are closed on Monday.'], bot: ['Large photo at the top.'] }
    })
    const text = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(text).toContain('What the team remembers')
    expect(text).toContain('- Offices are closed on Monday.')
    expect(text).toContain('What Iris remembers')
    expect(text).toContain('- Large photo at the top.')
    expect(text).toContain('orca orchestration team-remember --text')
  })

  it('names no memory section when there is nothing remembered', async () => {
    const d = deps()
    await startBotTeamTask(d, { team: TEAM, task: TASK, memory: { team: [], bot: [] } })
    const text = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(text).not.toContain('What the team remembers')
    expect(text).not.toContain('What Iris remembers')
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

  it('runs a task of a project linked to a repo in the workspace prepared for that task, not the team folder', async () => {
    const d = deps()
    await startBotTeamTask(d, {
      team: TEAM,
      task: { ...TASK, projectId: 'project' },
      project: { ...PROJECT, workspace: { key: 'repo:repo-1', name: 'NexusCare' } }
    })

    expect(d.ensureTeamWorkspace).not.toHaveBeenCalled()
    expect(d.prepareLinkedWorkspace).toHaveBeenCalledWith({
      projectId: 'project',
      workspaceKey: 'repo:repo-1',
      taskTitle: 'Flyer'
    })
    expect(d.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'repo-1::/work/nexus-task' })
    )
  })

  it('keeps the task in Todo, with the reason, when the linked workspace is gone', async () => {
    const d = deps({ prepareLinkedWorkspace: vi.fn(async () => null) })

    await expect(
      startBotTeamTask(d, {
        team: TEAM,
        task: { ...TASK, projectId: 'project' },
        project: { ...PROJECT, workspace: { key: 'repo:repo-1', name: 'NexusCare' } }
      })
    ).rejects.toThrow(
      'The Workspaces project linked to Summer campaign is gone. Link another one or clear the link.'
    )
    expect(d.createSession).not.toHaveBeenCalled()
    expect(d.linkSession).not.toHaveBeenCalled()
  })

  it('keeps the team folder for a project with no link', async () => {
    const d = deps()
    await startBotTeamTask(d, {
      team: TEAM,
      task: { ...TASK, projectId: 'project' },
      project: { ...PROJECT, workspace: null }
    })

    expect(d.prepareLinkedWorkspace).not.toHaveBeenCalled()
    expect(d.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'folder:1' })
    )
  })
})

describe('the task prompt and the room', () => {
  it('says the task is already on the board and asks for one finish line only', async () => {
    const { botTeamTaskPrompt } = await import('./bot-team-task-start')
    const bot = {
      id: 'b',
      name: 'José',
      job: 'Front',
      agent: 'claude' as const,
      modelMode: 'auto' as const,
      model: null,
      effort: null,
      skills: []
    }
    const team = {
      id: 't',
      name: 'Dev',
      purpose: '',
      character: 'circle' as const,
      workspacesEnabled: false,
      accessMode: 'default' as const,
      bots: [bot]
    }
    const prompt = botTeamTaskPrompt(team, bot, { title: 'Colors', prompt: 'Show a colors card' })
    expect(prompt).toContain('This task is already on the board')
    expect(prompt).toContain('when you finish')
    expect(prompt).not.toContain('when you take this on')
  })
})
