import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('a bot repeating its line in the same task', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    vi.useRealTimers()
  })

  function setup() {
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Eng',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Juan', job: '', agent: 'claude' },
        { name: 'Ana', job: '', agent: 'claude' }
      ]
    })
    const [juan, ana] = team.bots
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Backend',
      prompt: 'Explore',
      ownerBotId: juan.id
    })
    return { team, juan, ana, task }
  }

  const texts = (teamId: string) => db!.listBotTeamMessages(teamId).map((m) => m.text)

  it('keeps one copy of an identical line and returns the one already there', () => {
    const { team, juan } = setup()
    const first = db!.postBotTeamMessage({
      teamId: team.id,
      authorBotId: juan.id,
      text: 'Yo complete la exploracion backend'
    })
    vi.setSystemTime(Date.now() + 60_000)
    const again = db!.postBotTeamMessage({
      teamId: team.id,
      authorBotId: juan.id,
      text: 'Yo complete la exploracion backend'
    })

    expect(again.id).toBe(first.id)
    expect(texts(team.id)).toEqual(['Yo complete la exploracion backend'])
  })

  it('lets another bot, the person, or a different line through', () => {
    const { team, juan, ana } = setup()
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: juan.id, text: 'Listo' })
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: ana.id, text: 'Listo' })
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Listo' })
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: juan.id, text: 'Listo otra vez' })

    expect(texts(team.id)).toEqual(['Listo', 'Listo', 'Listo', 'Listo otra vez'])
  })

  it('lets the same line through once the bot starts a new task', () => {
    const { team, juan } = setup()
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: juan.id, text: 'Listo' })
    vi.setSystemTime(Date.now() + 60_000)
    db!.createBotTeamTask({
      teamId: team.id,
      title: 'Next',
      prompt: 'Again',
      ownerBotId: juan.id
    })
    db!.postBotTeamMessage({ teamId: team.id, authorBotId: juan.id, text: 'Listo' })

    expect(texts(team.id)).toEqual(['Listo', 'Listo'])
  })
})
