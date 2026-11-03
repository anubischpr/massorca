import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { listBotTeamSessionTeams } from './bot-team-session-team'

describe('listBotTeamSessionTeams', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function makeTeam(name: string, character: 'circle' | 'square') {
    const created = (db as OrchestrationDb).createBotTeam({
      name,
      purpose: '',
      character,
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    return { team: created, botId: created.bots[0].id }
  }

  function insertDelegation(id: string, parentSessionId: string, childSessionId: string | null) {
    ;(db as OrchestrationDb).db
      .prepare(
        `INSERT INTO delegation_requests
          (id, parent_session_id, title, summary, prompt, workspace_kind, options_json, child_session_id)
         VALUES (?, ?, 'Flyer', '', 'Make it', 'folder', '[]', ?)`
      )
      .run(id, parentSessionId, childSessionId)
  }

  it('maps a task session and its child sessions to the owning team and character', () => {
    db = new OrchestrationDb(':memory:')
    const { team, botId } = makeTeam('Marketing', 'circle')
    const task = (db as OrchestrationDb).createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: botId
    })
    ;(db as OrchestrationDb).setBotTeamTaskSession(task.id, 'session-task')
    insertDelegation('req-1', 'session-task', 'session-child')
    insertDelegation('req-2', 'session-child', 'session-grandchild')

    expect(listBotTeamSessionTeams(db as OrchestrationDb)).toEqual({
      'session-task': { teamId: team.id, teamName: 'Marketing', character: 'circle' },
      'session-child': { teamId: team.id, teamName: 'Marketing', character: 'circle' },
      'session-grandchild': { teamId: team.id, teamName: 'Marketing', character: 'circle' }
    })
  })

  it('maps a delegated task session through its delegation request before the link is stored', () => {
    db = new OrchestrationDb(':memory:')
    const { team, botId } = makeTeam('Sales', 'square')
    const task = (db as OrchestrationDb).createBotTeamTask({
      teamId: team.id,
      title: 'Leads',
      prompt: 'Find leads',
      ownerBotId: botId
    })
    insertDelegation('req-3', 'parent-session', 'session-delegated')
    ;(db as OrchestrationDb).linkBotTeamTaskDelegation(task.id, 'req-3')

    expect(listBotTeamSessionTeams(db as OrchestrationDb)['session-delegated']).toEqual({
      teamId: team.id,
      teamName: 'Sales',
      character: 'square'
    })
  })

  it('leaves sessions that bot-team tasks did not start out of the map', () => {
    db = new OrchestrationDb(':memory:')
    const { team, botId } = makeTeam('Marketing', 'circle')
    const task = (db as OrchestrationDb).createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: botId
    })
    ;(db as OrchestrationDb).setBotTeamTaskSession(task.id, 'session-task')
    insertDelegation('req-4', 'plain-parent', 'plain-child')

    const map = listBotTeamSessionTeams(db as OrchestrationDb)
    expect(Object.keys(map)).toEqual(['session-task'])
  })

  it('returns an empty map when no bot team has a session', () => {
    db = new OrchestrationDb(':memory:')
    makeTeam('Marketing', 'circle')

    expect(listBotTeamSessionTeams(db as OrchestrationDb)).toEqual({})
  })
})
