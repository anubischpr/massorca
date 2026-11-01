import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team room store', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function createTeam(open: OrchestrationDb) {
    return open.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
  }

  it('saves a task with no session, so it waits in Todo until it starts', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)

    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design the flyer',
      ownerBotId: team.bots[0].id
    })

    expect(task).toMatchObject({ title: 'Flyer', sessionId: null })
    expect(db.listBotTeamTasks(team.id)).toEqual([task])
  })

  it('links a started task to its session and finds it from that session', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: '',
      ownerBotId: team.bots[0].id
    })

    const started = db.setBotTeamTaskSession(task.id, 'session-1')

    expect(started.sessionId).toBe('session-1')
    expect(db.findBotTeamTaskBySession('session-1')?.id).toBe(task.id)
    expect(db.findBotTeamTaskBySession('other')).toBeNull()
  })

  it('refuses a task for a bot of another team', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const other = createTeam(db)

    expect(() =>
      db?.createBotTeamTask({
        teamId: team.id,
        title: 'Flyer',
        prompt: '',
        ownerBotId: other.bots[0].id
      })
    ).toThrow('is not on team')
    expect(db.listBotTeamTasks(team.id)).toEqual([])
  })

  it('keeps the room messages in order, from the person and from bots', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)

    db.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Launch is Friday' })
    db.postBotTeamMessage({ teamId: team.id, authorBotId: team.bots[0].id, text: 'Got it' })

    expect(db.listBotTeamMessages(team.id)).toMatchObject([
      { authorBotId: null, text: 'Launch is Friday' },
      { authorBotId: team.bots[0].id, text: 'Got it' }
    ])
  })

  it('removes tasks and messages with their team', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    db.createBotTeamTask({ teamId: team.id, title: 'A', prompt: '', ownerBotId: team.bots[0].id })
    db.postBotTeamMessage({ teamId: team.id, authorBotId: null, text: 'Hi' })

    db.deleteBotTeam(team.id)

    expect(db.listBotTeamTasks(team.id)).toEqual([])
    expect(db.listBotTeamMessages(team.id)).toEqual([])
  })
})
