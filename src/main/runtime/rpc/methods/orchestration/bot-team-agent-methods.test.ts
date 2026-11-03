import { describe, expect, it } from 'vitest'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import { requireBotTeamCallerTask } from './bot-team-agent-methods'

const TASK: BotTeamTask = {
  id: 'task',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  projectId: null,
  sessionId: 'session-1'
}
const db = {
  findBotTeamTaskBySession: (sessionId: string) => (sessionId === 'session-1' ? TASK : null)
}

describe('requireBotTeamCallerTask', () => {
  it('finds the task the calling chat runs', () => {
    expect(requireBotTeamCallerTask(db, 'session-1')).toBe(TASK)
  })

  it('refuses a chat outside Bot teams and a caller with no chat', () => {
    expect(() => requireBotTeamCallerTask(db, 'other')).toThrow('Only a chat that runs')
    expect(() => requireBotTeamCallerTask(db, undefined)).toThrow('Only a chat that runs')
  })
})

describe('botTeamDelegationProject', () => {
  it('keeps a project another team owns and linked to the caller, even archived', async () => {
    const { OrchestrationDb } = await import('../../../orchestration/db/orchestration-db')
    const { botTeamDelegationProject } = await import('./bot-team-agent-methods')
    const open = new OrchestrationDb(':memory:')
    try {
      const make = (name: string) =>
        open.createBotTeam({
          name,
          purpose: '',
          character: 'circle',
          workspacesEnabled: false,
          bots: [{ name: `${name} bot`, job: '', agent: 'claude' }]
        })
      const marketing = make('Marketing')
      const development = make('Development')
      const project = open.createBotTeamProject({
        teamId: marketing.id,
        name: 'NexusCare',
        goal: '',
        codeSource: null,
        linkedTeamIds: [development.id]
      })
      open.setBotTeamProjectArchived(project.id, true)
      const caller = { ...TASK, teamId: development.id, projectId: project.id }

      expect(botTeamDelegationProject(open, caller, development.id)?.id).toBe(project.id)
      expect(botTeamDelegationProject(open, caller, marketing.id)).toBeNull()
      expect(
        botTeamDelegationProject(open, { ...caller, projectId: null }, development.id)
      ).toBeNull()
    } finally {
      open.close()
    }
  })
})

describe('orchestration.botTeamTaskCreate', () => {
  it('files the new card in the project of the task that made it', async () => {
    const { OrchestrationDb } = await import('../../../orchestration/db/orchestration-db')
    const { ORCHESTRATION_BOT_TEAM_METHODS } = await import('./bot-team-agent-methods')
    const open = new OrchestrationDb(':memory:')
    try {
      const team = open.createBotTeam({
        name: 'Dev',
        purpose: '',
        character: 'circle',
        workspacesEnabled: false,
        bots: [{ name: 'José', job: 'Front', agent: 'claude' }]
      })
      const project = open.createBotTeamProject({
        teamId: team.id,
        name: 'NexusCare',
        goal: '',
        codeSource: null
      })
      const running = open.createBotTeamTask({
        teamId: team.id,
        title: 'Colors card',
        prompt: 'Show a colors card',
        ownerBotId: team.bots[0].id
      })
      open.setBotTeamTaskProject(running.id, project.id)
      open.setBotTeamTaskSession(running.id, 'session-1')
      const method = ORCHESTRATION_BOT_TEAM_METHODS.find(
        (entry) => entry.name === 'orchestration.botTeamTaskCreate'
      )!
      const ctx = {
        runtime: { getOrchestrationDb: () => open },
        orchestrationCaller: { sessionId: 'session-1' }
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only reads the db and caller session.
      const result = (await method.handler({ text: 'Pick a color' } as never, ctx as never)) as {
        task: BotTeamTask
      }
      expect(result.task.projectId).toBe(project.id)
    } finally {
      open.close()
    }
  })
})
