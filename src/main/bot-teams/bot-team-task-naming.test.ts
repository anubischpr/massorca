import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { nameBotTeamTasksWith } from './bot-team-task-naming'

const LONG = 'puedes ejecutar un comando de bash de un wait de 60 segundos?'

describe('bot team task names', () => {
  let db: OrchestrationDb | undefined
  let stop: (() => void) | undefined

  afterEach(() => {
    stop?.()
    db?.close()
    db = undefined
  })

  function makeTask(open: OrchestrationDb, title = LONG) {
    const team = open.createBotTeam({
      name: 'Ops',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Juan', job: 'Runs commands', agent: 'claude' }]
    })
    return open.createBotTeamTask({
      teamId: team.id,
      title,
      prompt: LONG,
      ownerBotId: team.bots[0].id
    })
  }

  it('replaces the provisional title with a generated name, and keeps the request', async () => {
    db = new OrchestrationDb(':memory:')
    const generate = vi.fn(async () => 'Run a 60 second bash wait')
    stop = nameBotTeamTasksWith(generate)
    const task = makeTask(db)
    expect(task.title).toBe(LONG)
    await vi.waitFor(() =>
      expect(db!.getBotTeamTask(task.id)?.title).toBe('Run a 60 second bash wait')
    )
    expect(db.getBotTeamTask(task.id)?.prompt).toBe(LONG)
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ originalPrompt: LONG }))
  })

  it('keeps the provisional title when no name can be generated', async () => {
    db = new OrchestrationDb(':memory:')
    const generate = vi.fn(async () => null)
    stop = nameBotTeamTasksWith(generate)
    const task = makeTask(db)
    await vi.waitFor(() => expect(generate).toHaveBeenCalled())
    expect(db.getBotTeamTask(task.id)?.title).toBe(LONG)
  })

  it('does not overwrite a title that changed while the name was being made', async () => {
    db = new OrchestrationDb(':memory:')
    let finish: (name: string) => void = () => {}
    stop = nameBotTeamTasksWith(() => new Promise((resolve) => (finish = resolve)))
    const task = makeTask(db)
    db.db.prepare('UPDATE bot_team_tasks SET title = ? WHERE id = ?').run('Renamed', task.id)
    finish('Generated')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(db.getBotTeamTask(task.id)?.title).toBe('Renamed')
  })

  it('names nothing once stopped', async () => {
    db = new OrchestrationDb(':memory:')
    const generate = vi.fn(async () => 'Name')
    nameBotTeamTasksWith(generate)()
    makeTask(db)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(generate).not.toHaveBeenCalled()
  })
})
