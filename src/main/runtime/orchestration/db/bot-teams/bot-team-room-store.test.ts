import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../../shared/bot-team-greeting'
import { SCHEMA_VERSION } from '../contract-constants'
import { OrchestrationDb } from '../orchestration-db'

describe('bot team room store', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
    vi.useRealTimers()
  })

  it('writes the host time on each task and message it saves', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(5_000)
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const message = db.postBotTeamMessage({
      teamId: team.id,
      text: 'Make the flyer',
      authorBotId: null
    })
    vi.setSystemTime(9_000)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: team.bots[0].id
    })

    expect(message.createdAt).toBe(5_000)
    expect(task.createdAt).toBe(9_000)
    expect(db.listBotTeamMessages(team.id)).toEqual([
      expect.objectContaining({ id: message.id, createdAt: 5_000 })
    ])
    expect(db.listBotTeamTasks(team.id)).toEqual([expect.objectContaining({ createdAt: 9_000 })])
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

  it('never replaces the session of a task that already has one', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design the flyer',
      ownerBotId: team.bots[0].id
    })
    expect(db.setBotTeamTaskSession(task.id, 'first').sessionId).toBe('first')
    expect(db.setBotTeamTaskSession(task.id, 'second').sessionId).toBe('first')
  })

  it('knows a task handed to a teammate is on its way, until the request settles', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design the flyer',
      ownerBotId: team.bots[0].id
    })
    expect(db.isBotTeamTaskHandedOff(task.id)).toBe(false)
    const request = db.createDelegationRequest({
      parentSessionId: 'parent',
      title: 'Flyer',
      summary: 'Flyer',
      prompt: 'Design the flyer',
      writes: false,
      workspaceKind: 'folder',
      optionsJson: '{"agents":[]}',
      decisionJson: null
    })
    db.linkBotTeamTaskDelegation(task.id, request.id)
    expect(db.isBotTeamTaskHandedOff(task.id)).toBe(true)
    db.transitionDelegationRequest(request.id, 'pending', 'failed', {})
    expect(db.isBotTeamTaskHandedOff(task.id)).toBe(false)
  })

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

  it('links a delegated task to its child session once the child has started', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'A',
      prompt: '',
      ownerBotId: team.bots[0].id
    })
    const request = db.createDelegationRequest({
      parentSessionId: 'orca_parent',
      title: 'A',
      summary: 'A',
      prompt: 'A',
      writes: false,
      workspaceKind: 'folder',
      optionsJson: '{}',
      decisionJson: null
    })
    db.linkBotTeamTaskDelegation(task.id, request.id)
    expect(db.listBotTeamTasks(team.id)[0].sessionId).toBeNull()

    db.patchDelegationRequest(request.id, { child_session_id: 'child-1' })

    expect(db.findBotTeamTaskBySession('child-1')?.id).toBe(task.id)
    expect(db.listBotTeamTasks(team.id)[0].sessionId).toBe('child-1')
  })

  it('refuses to remove a bot that still has tasks, and keeps it', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    db.createBotTeamTask({ teamId: team.id, title: 'A', prompt: '', ownerBotId: team.bots[0].id })

    expect(() => db?.removeBotFromTeam(team.id, team.bots[0].id)).toThrow('still has tasks')
    expect(db.listBotTeams()[0].bots).toHaveLength(1)
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

  it('keeps the team greeting as one line from All, with no bot behind it', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    db.postBotTeamMessage({ teamId: team.id, text: 'Hola', authorBotId: null })
    const line = db.postBotTeamMessage({
      teamId: team.id,
      text: 'Hola! 👋',
      authorBotId: BOT_TEAM_ALL_AUTHOR
    })
    expect(line.authorBotId).toBe(BOT_TEAM_ALL_AUTHOR)
    expect(db.listBotTeamMessages(team.id).map((message) => message.authorBotId)).toEqual([
      null,
      BOT_TEAM_ALL_AUTHOR
    ])
    const stored = db.db
      .prepare('SELECT author_bot_id AS bot FROM bot_team_messages WHERE id = ?')
      .get(line.id)
    expect(stored).toEqual({ bot: null })
  })

  it('adds the greeting marker to an older database and survives a restart from v6', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    db.postBotTeamMessage({ teamId: team.id, text: 'Design it', authorBotId: team.bots[0].id })
    db.db.exec('ALTER TABLE bot_team_messages DROP COLUMN author_kind')
    db.db.pragma('user_version = 50')

    db.migrate()
    expect(db.listBotTeamMessages(team.id)).toEqual([
      expect.objectContaining({ text: 'Design it', authorBotId: team.bots[0].id })
    ])

    db.db.pragma('user_version = 6')
    expect(() => db?.migrate()).not.toThrow()
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })

  it('moves a task to another bot and team, clearing what the old owner started', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const other = db.createBotTeam({
      name: 'Warehouse',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Bea', job: 'Counts', agent: 'claude' }]
    })
    const project = db.createBotTeamProject({
      teamId: team.id,
      name: 'Summer',
      goal: '',
      codeSource: null
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Count',
      prompt: 'Count the boxes',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskProject(task.id, project.id)
    db.setBotTeamTaskSession(task.id, 'session-1')

    db.moveBotTeamTask(task.id, {
      teamId: other.id,
      ownerBotId: other.bots[0].id,
      startNotes: 'Handed over'
    })

    expect(db.getBotTeamTask(task.id)).toMatchObject({
      teamId: other.id,
      ownerBotId: other.bots[0].id,
      sessionId: null,
      projectId: null,
      prompt: 'Count the boxes'
    })
    expect(db.getBotTeamTaskStartNotes(task.id)).toBe('Handed over')
    expect(db.listBotTeamTasks(team.id)).toEqual([])
  })

  it('keeps notes for a task start, and clears them with null', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design it',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskStartNotes(task.id, 'Needs Max')
    expect(db.getBotTeamTaskStartNotes(task.id)).toBe('Needs Max')
    db.setBotTeamTaskStartNotes(task.id, null)
    expect(db.getBotTeamTaskStartNotes(task.id)).toBeNull()
  })

  it('does not bring back the old session of a task that was delegated, once it is moved', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design it',
      ownerBotId: team.bots[0].id
    })
    db.db
      .prepare('INSERT INTO bot_team_task_delegations (task_id, request_id) VALUES (?, ?)')
      .run(task.id, 'request-1')
    db.moveBotTeamTask(task.id, {
      teamId: team.id,
      ownerBotId: team.bots[0].id,
      startNotes: null
    })
    expect(db.getBotTeamTask(task.id).sessionId).toBeNull()
    expect(db.getBotTeamTaskStartNotes(task.id)).toBeNull()
  })

  it('adds the start notes to an older database and survives a restart from v6', () => {
    db = new OrchestrationDb(':memory:')
    const team = createTeam(db)
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Design it',
      ownerBotId: team.bots[0].id
    })
    db.db.exec('ALTER TABLE bot_team_tasks DROP COLUMN start_notes')
    db.db.pragma('user_version = 51')
    db.migrate()
    expect(db.getBotTeamTaskStartNotes(task.id)).toBeNull()
    db.db.pragma('user_version = 6')
    expect(() => db?.migrate()).not.toThrow()
    expect(db.db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })
})
