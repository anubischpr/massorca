import { describe, expect, it } from 'vitest'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../shared/rpc-contract/bot-team-room-params'
import { botTeamTaskPrompt } from './bot-team-task-start'

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
const TASK = { title: 'Flyer', prompt: 'Design the flyer' }
const PROJECT: BotTeamProject = {
  id: 'p',
  teamId: 'team',
  name: 'Summer',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}

describe('botTeamTaskPrompt context', () => {
  it('names the brief only when the project has one', () => {
    const without = botTeamTaskPrompt(TEAM, BOT, TASK, { project: PROJECT })
    expect(without).toContain('part of the project "Summer"')
    expect(without).not.toContain('Read its brief')
    const withBrief = botTeamTaskPrompt(TEAM, BOT, TASK, {
      project: { ...PROJECT, brief: { ...PROJECT.brief, requirements: ['Two colors'] } }
    })
    expect(withBrief).toContain('Read its brief before you start.')
    const markdown = botTeamTaskPrompt(TEAM, BOT, TASK, {
      project: { ...PROJECT, brief: { ...PROJECT.brief, markdown: '# Brief' } }
    })
    expect(markdown).toContain('Read its brief before you start.')
  })

  it('carries the recent room messages and the working directory', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK, {
      roomExcerpt: ['Person: hola', 'Max: listo'],
      workingDirectory: '/work/task-1'
    })
    expect(prompt).toContain('Recent Conference room messages, oldest first')
    expect(prompt).toContain('Max: listo')
    expect(prompt).toContain('Your working directory is /work/task-1.')
  })

  it('keeps the room excerpt from reopening finished work, and files what the person asks to keep', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK, { roomExcerpt: ['Person: informe'] })
    expect(prompt).toContain('Do not redo work that is already finished')
    expect(prompt).toContain('for future reference')
    expect(prompt).toContain('say in the Conference room that it is saved')
  })

  it('tells a teammate child to do the work itself and never to dispatch sub-workers', () => {
    const child = botTeamTaskPrompt(TEAM, BOT, TASK, { delegated: true })
    expect(child).toContain('do not dispatch sub-workers')
    expect(child).not.toContain('To hand work to a teammate, run')
    expect(child).not.toContain('team-delegate')
    const owner = botTeamTaskPrompt(TEAM, BOT, TASK)
    expect(owner).toContain('To hand work to a teammate, run')
    expect(owner).not.toContain('do not dispatch sub-workers')
  })

  it('tells the bot to write in its current folder when no directory is known', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK)
    expect(prompt).not.toContain('Recent Conference room messages')
    expect(prompt).toContain('current working directory')
  })

  it('points at Engram and OpenMetadata by their real names, and at the room voice', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK)
    expect(prompt).toContain('mcp__engram__mem_search')
    expect(prompt).not.toContain('plugin_engram')
    expect(prompt).toContain('never "openmetadata-escritura"')
    expect(prompt).toContain('first person')
    expect(prompt).toContain('names the final deliverable')
  })

  it('has a delegated bot say what it takes before it starts', () => {
    const prompt = botTeamTaskPrompt(TEAM, BOT, TASK, { delegated: true })
    expect(prompt).toContain('does not say you took it yet')
    expect(botTeamTaskPrompt(TEAM, BOT, TASK)).toContain('the room already says you took it')
  })
})
