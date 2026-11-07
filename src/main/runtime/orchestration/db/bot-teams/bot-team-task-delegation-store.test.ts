import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { findHandedOverBotTeamTask } from './bot-team-task-delegation-store'

describe('finding work a session already handed to a teammate', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function handedOver(status?: 'failed') {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Eng',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Ann', job: '', agent: 'claude' }]
    })
    const request = db.createDelegationRequest({
      parentSessionId: 'parent',
      title: 'Part',
      summary: 'Part',
      prompt: 'p',
      writes: false,
      workspaceKind: 'folder',
      optionsJson: '{}',
      decisionJson: null
    })
    if (status) {
      db.db
        .prepare('UPDATE delegation_requests SET status = ? WHERE id = ?')
        .run(status, request.id)
    }
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Part',
      prompt: 'Review the API',
      ownerBotId: team.bots[0].id
    })
    db.linkBotTeamTaskDelegation(task.id, request.id)
    return { task, ownerBotId: team.bots[0].id }
  }

  it('finds the task for the same session, teammate and text', () => {
    const { task, ownerBotId } = handedOver()
    const args = { parentSessionId: 'parent', ownerBotId, prompt: 'Review the API' }
    expect(findHandedOverBotTeamTask(db!, args)?.id).toBe(task.id)
    expect(findHandedOverBotTeamTask(db!, { ...args, prompt: 'Other' })).toBeNull()
    expect(findHandedOverBotTeamTask(db!, { ...args, parentSessionId: 'other' })).toBeNull()
  })

  it('lets a request that failed be asked again', () => {
    const { ownerBotId } = handedOver('failed')
    expect(
      findHandedOverBotTeamTask(db!, {
        parentSessionId: 'parent',
        ownerBotId,
        prompt: 'Review the API'
      })
    ).toBeNull()
  })
})
