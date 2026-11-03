import { describe, expect, it } from 'vitest'
import { botTeamTaskPrompt } from './bot-team-task-start'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../shared/rpc-contract/bot-team-room-params'

const BOT = {
  id: 'bot',
  name: 'Iris',
  job: 'Designs flyers',
  agent: 'codex' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}
const TEAM: BotTeam = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'full-access',
  bots: [BOT]
}
const TASK = { title: 'Deck', prompt: 'Make the presentation' }

describe('botTeamTaskPrompt deliverables', () => {
  it('tells the bot to save what it produces in the team folder so it shows in Files and Versions', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK)

    expect(prompt).toContain('Save every file you produce in the team folder')
    expect(prompt).toContain('Files and Versions')
  })

  it("points to the project's workspace when the task runs there", () => {
    const project = {
      id: 'p',
      teamId: 'team',
      name: 'Site',
      goal: '',
      codeSource: null,
      brief: { requirements: [], constraints: [], decisions: [] },
      briefUpdatedAt: null,
      workspace: { key: 'ws', name: 'Site' }
    } as BotTeamProject

    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK, { project })

    expect(prompt).toContain("Save every file you produce in this project's workspace")
    expect(prompt).not.toContain('in the team folder')
  })
})
