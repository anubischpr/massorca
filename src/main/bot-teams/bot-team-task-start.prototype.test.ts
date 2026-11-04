import { describe, expect, it, vi } from 'vitest'
import { startBotTeamTask, type BotTeamTaskStartDeps } from './bot-team-task-start'
import { withBotTeamPrototypeChoice } from '../../shared/bot-team-prototype-choice'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'

const TEAM: BotTeam = {
  id: 'team',
  name: 'Web',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [
    {
      id: 'bot',
      name: 'Ana',
      job: 'Designer',
      agent: 'claude',
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
  title: 'Landing',
  prompt: 'crea 3 prototipos de la landing',
  ownerBotId: 'bot',
  sessionId: null,
  projectId: null
}
const CLOCK = "The person's clock when they asked: Tuesday 2026-11-03 23:38 America/Lima."

function deps(overrides: Partial<BotTeamTaskStartDeps> = {}): BotTeamTaskStartDeps {
  return {
    ensureTeamWorkspace: vi.fn(async () => 'folder:1'),
    prepareLinkedWorkspace: vi.fn(async () => null),
    createSession: vi.fn(async () => 'session-1'),
    sendPrompt: vi.fn(async () => true),
    linkSession: vi.fn((_taskId, sessionId) => ({ ...TASK, sessionId })),
    ...overrides
  }
}

describe('a task started with a prototype choice', () => {
  it('sends the prototype first prompt, keeping the clock, and never shows the choice line', async () => {
    const discard = vi.fn(async () => {})
    const prototypeFirstPrompt = vi.fn(async () => ({
      body: 'PROTOTYPE BODY',
      appendix: 'HIDDEN APPENDIX',
      discard
    }))
    const d = deps({ prototypeFirstPrompt })
    await startBotTeamTask(d, {
      team: TEAM,
      task: TASK,
      notes: withBotTeamPrototypeChoice(CLOCK, { count: 3, designSystem: 'propose' })
    })

    expect(prototypeFirstPrompt).toHaveBeenCalledWith({
      childSessionId: 'session-1',
      taskSpec: 'crea 3 prototipos de la landing',
      count: 3,
      designSystem: 'propose'
    })
    const prompt = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(prompt).toContain('PROTOTYPE BODY')
    expect(prompt).not.toContain('crea 3 prototipos')
    expect(prompt).toContain(CLOCK)
    expect(prompt).not.toContain('Prototype choice')
    expect(prompt.endsWith('HIDDEN APPENDIX')).toBe(true)
    expect(discard).not.toHaveBeenCalled()
  })

  it('sends the raw prompt when the host makes no prototype prompt', async () => {
    const d = deps({ prototypeFirstPrompt: vi.fn(async () => null) })
    await startBotTeamTask(d, {
      team: TEAM,
      task: TASK,
      notes: withBotTeamPrototypeChoice(CLOCK, { count: 2 })
    })
    const prompt = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(prompt).toContain('crea 3 prototipos de la landing')
    expect(prompt).not.toContain('Prototype choice')
  })

  it('discards the request folder when the prompt does not reach the bot', async () => {
    const discard = vi.fn(async () => {})
    const d = deps({
      sendPrompt: vi.fn(async () => false),
      prototypeFirstPrompt: vi.fn(async () => ({ body: 'B', appendix: 'A', discard }))
    })
    await expect(
      startBotTeamTask(d, {
        team: TEAM,
        task: TASK,
        notes: withBotTeamPrototypeChoice(null, { count: 1 })
      })
    ).rejects.toThrow('did not reach the bot')
    expect(discard).toHaveBeenCalledOnce()
  })

  it('sends the raw prompt, as before, without a choice', async () => {
    const prototypeFirstPrompt = vi.fn(async () => null)
    const d = deps({ prototypeFirstPrompt })
    await startBotTeamTask(d, { team: TEAM, task: TASK, notes: CLOCK })
    expect(prototypeFirstPrompt).not.toHaveBeenCalled()
    expect(vi.mocked(d.sendPrompt).mock.calls[0][1]).toContain('crea 3 prototipos de la landing')
  })
})
