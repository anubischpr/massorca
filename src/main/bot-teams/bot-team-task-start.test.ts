import { describe, expect, it, vi } from 'vitest'
import { startBotTeamTask, type BotTeamTaskStartDeps } from './bot-team-task-start'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'

const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [{ id: 'bot', name: 'Iris', job: 'Designs flyers', agent: 'codex' }]
}
const TASK: BotTeamTask = {
  id: 'task',
  teamId: 'team',
  title: 'Flyer',
  prompt: 'Design the flyer',
  ownerBotId: 'bot',
  sessionId: null
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

describe('startBotTeamTask', () => {
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
