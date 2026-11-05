import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botRunOfCallerSession, botRunOfDelegatedDispatch } from './bot-team-delegated-run'

const SYSTEM = { kind: 'system' } as never

describe('botRunOfDelegatedDispatch', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  /** A team with a delegator and a teammate; the request hands a part to `owner`. */
  function delegation(ownerIndex: 0 | 1) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Ann', job: '', agent: 'claude' },
        { name: 'Bob', job: '', agent: 'codex' }
      ]
    })
    const request = db.createDelegationRequest({
      parentSessionId: 'delegator-session',
      title: 'Part',
      summary: 'Part',
      prompt: 'Part',
      writes: false,
      workspaceKind: 'folder',
      optionsJson: '{}',
      decisionJson: null
    })
    const part = db.createBotTeamTask({
      teamId: team.id,
      title: 'Part',
      prompt: 'Part',
      ownerBotId: team.bots[ownerIndex].id
    })
    db.linkBotTeamTaskDelegation(part.id, request.id)
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'Part' })
    db.patchDelegationRequest(request.id, { task_id: task.id })
    const dispatch = db.createDispatchContext({
      taskId: task.id,
      assigneeHandle: 'term_child',
      creator: SYSTEM,
      maxDepth: 5
    })
    return { team, dispatch }
  }

  it('names the teammate doing the work, never the delegator', () => {
    const { team, dispatch } = delegation(1)
    expect(botRunOfDelegatedDispatch(db!, dispatch.id)).toEqual({
      botId: team.bots[1].id,
      teamId: team.id
    })
  })

  it('names nobody for a dispatch that is not a bot teammate delegation', () => {
    const { dispatch } = delegation(0)
    const plain = db!.createTask({ runId: 'run_legacy_local', spec: 'Plain' })
    const other = db!.createDispatchContext({
      taskId: plain.id,
      assigneeHandle: 'term_other',
      creator: SYSTEM,
      maxDepth: 5
    })
    expect(botRunOfDelegatedDispatch(db!, other.id)).toBeNull()
    expect(botRunOfDelegatedDispatch(db!, 'ctx_missing')).toBeNull()
    expect(botRunOfDelegatedDispatch(db!, dispatch.id)).not.toBeNull()
  })

  describe('a child that is not a bot hand-over', () => {
    /** A dispatch for a plain delegation filed by `parentSessionId`. */
    function plainChild(parentSessionId: string, childSessionId?: string) {
      const request = db!.createDelegationRequest({
        parentSessionId,
        title: 'Plain',
        summary: 'Plain',
        prompt: 'Plain',
        writes: false,
        workspaceKind: 'folder',
        optionsJson: '{}',
        decisionJson: null
      })
      const task = db!.createTask({ runId: 'run_legacy_local', spec: 'Plain' })
      db!.patchDelegationRequest(request.id, {
        task_id: task.id,
        ...(childSessionId ? { child_session_id: childSessionId } : {})
      })
      const dispatch = db!.createDispatchContext({
        taskId: task.id,
        assigneeHandle: `term_${request.id}`,
        creator: SYSTEM,
        maxDepth: 5
      })
      return Object.assign(dispatch, { requestId: request.id })
    }

    function teamWithRunningTask() {
      db = new OrchestrationDb(':memory:')
      const team = db.createBotTeam({
        name: 'Marketing',
        purpose: '',
        character: 'circle',
        workspacesEnabled: false,
        bots: [
          { name: 'Ann', job: '', agent: 'claude' },
          { name: 'Bob', job: '', agent: 'codex' }
        ]
      })
      const task = db.createBotTeamTask({
        teamId: team.id,
        title: 'Flyer',
        prompt: 'Flyer',
        ownerBotId: team.bots[0].id
      })
      db.setBotTeamTaskSession(task.id, 'ann-session')
      return team
    }

    it('keeps the restrictions of the bot whose session delegated it', () => {
      const team = teamWithRunningTask()
      const child = plainChild('ann-session', 'child-1')
      expect(botRunOfDelegatedDispatch(db!, child.id)).toEqual({
        botId: team.bots[0].id,
        teamId: team.id
      })
    })

    it('follows the chain of delegations back to the bot, however deep', () => {
      const team = teamWithRunningTask()
      plainChild('ann-session', 'child-1')
      const grandchild = plainChild('child-1', 'child-2')
      const greatGrandchild = plainChild('child-2')
      expect(botRunOfDelegatedDispatch(db!, grandchild.id)?.botId).toBe(team.bots[0].id)
      expect(botRunOfDelegatedDispatch(db!, greatGrandchild.id)?.botId).toBe(team.bots[0].id)
    })

    it('stays a teammate’s run when a teammate’s child delegates again', () => {
      const team = teamWithRunningTask()
      const handOver = plainChild('ann-session', 'bob-child')
      const bobTask = db!.createBotTeamTask({
        teamId: team.id,
        title: 'Part',
        prompt: 'Part',
        ownerBotId: team.bots[1].id
      })
      db!.linkBotTeamTaskDelegation(bobTask.id, handOver.requestId)
      const nested = plainChild('bob-child')
      expect(botRunOfDelegatedDispatch(db!, handOver.id)?.botId).toBe(team.bots[1].id)
      expect(botRunOfDelegatedDispatch(db!, nested.id)?.botId).toBe(team.bots[1].id)
    })

    it('keeps the teammate’s marker on a child opened one level below a hand-over', () => {
      const team = teamWithRunningTask()
      const request = db!.createDelegationRequest({
        parentSessionId: 'ann-session',
        title: 'Part',
        summary: 'Part',
        prompt: 'Part',
        writes: false,
        workspaceKind: 'folder',
        optionsJson: '{}',
        decisionJson: null
      })
      const bobTask = db!.createBotTeamTask({
        teamId: team.id,
        title: 'Part',
        prompt: 'Part',
        ownerBotId: team.bots[1].id
      })
      db!.linkBotTeamTaskDelegation(bobTask.id, request.id)
      const handOverTask = db!.createTask({ runId: 'run_legacy_local', spec: 'Part' })
      db!.patchDelegationRequest(request.id, {
        task_id: handOverTask.id,
        child_session_id: 'bob_child'
      })
      const handOver = db!.createDispatchContext({
        taskId: handOverTask.id,
        assigneeHandle: 'orca_session_id:bob_child',
        creator: SYSTEM,
        maxDepth: 1
      })
      const designRequest = db!.createDelegationRequest({
        parentSessionId: 'bob_child',
        title: 'Design',
        summary: 'Design',
        prompt: 'Design',
        writes: false,
        workspaceKind: 'folder',
        optionsJson: '{}',
        decisionJson: null
      })
      const designTask = db!.createTask({ runId: 'run_legacy_local', spec: 'Design' })
      db!.patchDelegationRequest(designRequest.id, { task_id: designTask.id })
      const design = db!.createDispatchContext({
        taskId: designTask.id,
        assigneeHandle: 'term_design',
        creator: { kind: 'session', orcaSessionId: 'bob_child' as never },
        maxDepth: 2
      })
      expect([handOver.depth, design.depth]).toEqual([1, 2])
      expect(botRunOfDelegatedDispatch(db!, design.id)).toEqual({
        botId: team.bots[1].id,
        teamId: team.id
      })
    })

    it('names nobody for a delegation by a session no bot task runs', () => {
      teamWithRunningTask()
      const child = plainChild('workspace-chat-session', 'child-9')
      expect(botRunOfDelegatedDispatch(db!, child.id)).toBeNull()
    })
  })

  describe('botRunOfCallerSession', () => {
    function runningBotTask() {
      db = new OrchestrationDb(':memory:')
      const team = db.createBotTeam({
        name: 'Marketing',
        purpose: '',
        character: 'circle',
        workspacesEnabled: false,
        bots: [{ name: 'Ann', job: '', agent: 'claude' }]
      })
      const task = db.createBotTeamTask({
        teamId: team.id,
        title: 'Flyer',
        prompt: 'Flyer',
        ownerBotId: team.bots[0].id
      })
      db.setBotTeamTaskSession(task.id, 'ann-session')
      return { bot: { botId: team.bots[0].id, teamId: team.id } }
    }

    it('reads the bot from the marker the caller session carries', () => {
      runningBotTask()
      const options = { botTeamBotId: 'bob', botTeamId: 't1' }
      expect(botRunOfCallerSession(db!, 'any-session', () => options)).toEqual({
        botId: 'bob',
        teamId: 't1'
      })
    })

    it('falls back to the bot task the session runs, or the chain it descends from', () => {
      const { bot } = runningBotTask()
      expect(botRunOfCallerSession(db!, 'ann-session', () => undefined)).toEqual(bot)
      const request = db!.createDelegationRequest({
        parentSessionId: 'ann-session',
        title: 'Plain',
        summary: 'Plain',
        prompt: 'Plain',
        writes: false,
        workspaceKind: 'folder',
        optionsJson: '{}',
        decisionJson: null
      })
      db!.patchDelegationRequest(request.id, { child_session_id: 'plain-child' })
      expect(botRunOfCallerSession(db!, 'plain-child', () => undefined)).toEqual(bot)
    })

    it('names nobody for a caller with no session or one no bot runs', () => {
      runningBotTask()
      expect(botRunOfCallerSession(db!, undefined, () => undefined)).toBeNull()
      expect(botRunOfCallerSession(db!, 'workspace-chat', () => undefined)).toBeNull()
    })
  })
})
