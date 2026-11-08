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
const HAND_OFF_TASK: BotTeamTask = {
  id: 'task',
  teamId: 'team',
  title: 'Clinical report',
  prompt:
    "Crea un nuevo diseño para la página 'clinical-report' en una sesión hija y otro para 'pipeline-activo' en otra sesión hija.",
  ownerBotId: 'bot',
  sessionId: null,
  projectId: null
}

function deps(overrides: Partial<BotTeamTaskStartDeps> = {}): BotTeamTaskStartDeps {
  return {
    ensureTeamWorkspace: vi.fn(async () => 'folder:1'),
    prepareLinkedWorkspace: vi.fn(async () => null),
    createSession: vi.fn(async () => 'session-1'),
    sendPrompt: vi.fn(async () => true),
    linkSession: vi.fn((_taskId, sessionId) => ({ ...HAND_OFF_TASK, sessionId })),
    ...overrides
  }
}

describe('a room task that hands its design to child sessions', () => {
  it("does not turn the bot's own task into a prototype request, so the children carry it", async () => {
    const prototypeFirstPrompt = vi.fn(async () => ({
      body: 'PROTOTYPE BODY',
      appendix: 'HIDDEN APPENDIX',
      discard: vi.fn(async () => {})
    }))
    const d = deps({ prototypeFirstPrompt })

    await startBotTeamTask(d, {
      team: TEAM,
      task: HAND_OFF_TASK,
      notes: withBotTeamPrototypeChoice(null, { count: 3, designSystem: 'use' })
    })

    expect(prototypeFirstPrompt).not.toHaveBeenCalled()
    const prompt = vi.mocked(d.sendPrompt).mock.calls[0][1]
    expect(prompt).not.toContain('PROTOTYPE BODY')
    expect(prompt).toContain('en una sesión hija')
    expect(prompt).not.toContain('Prototype choice')
  })
})
