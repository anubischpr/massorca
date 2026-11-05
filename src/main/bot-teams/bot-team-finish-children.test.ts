import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { createRootDispatch } from '../runtime/orchestration/db/root-dispatch-test-fixture'
import { reportFinishedBotTeamTask, type BotTeamFinishReportDeps } from './bot-team-finish-report'

const BOT_SESSION = 'session-1'
const CHILD_SESSION = 'child-session'
const TEAMMATE_SESSION = 'teammate-session'

type ChildStatus = 'pending' | 'started' | 'finished' | 'failed' | 'cancelled'

describe('reportFinishedBotTeamTask with child delegations and chat visuals', () => {
  let db: OrchestrationDb | undefined
  let root = ''
  let runId = ''

  afterEach(() => {
    db?.close()
    db = undefined
    rmSync(root, { recursive: true, force: true })
  })

  function setup(workspacesEnabled: boolean): { team: { id: string }; folder: string } {
    root = mkdtempSync(path.join(tmpdir(), 'bot-team-children-'))
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Informe',
      prompt: 'Prepara el informe',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, BOT_SESSION)
    const folder = path.join(root, team.id)
    mkdirSync(folder, { recursive: true })
    runId = db.createRun({
      objective: 'Delegated child sessions',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    }).id
    return { team, folder }
  }

  /** A child delegation of the bot's session, whose task settled with `result` when one is given. */
  function child(
    status: ChildStatus,
    options: { result?: unknown; session?: string; parent?: string } = {}
  ): string {
    const task = db!.createTask({ spec: 'Diseña la página', runId })
    const dispatch = createRootDispatch(db!, task.id, 'structworker_child')
    if (options.result !== undefined) {
      db!.db
        .prepare('UPDATE tasks SET result = ? WHERE id = ?')
        .run(JSON.stringify(options.result), task.id)
    }
    const request = db!.createDelegationRequest({
      parentSessionId: options.parent ?? BOT_SESSION,
      title: 'Diseña la página',
      summary: 'Diseña la página',
      prompt: 'Diseña la página',
      writes: true,
      workspaceKind: 'folder',
      optionsJson: JSON.stringify({ agents: [{ agent: 'claude', label: 'Claude' }] }),
      decisionJson: null
    })
    db!.patchDelegationRequest(request.id, {
      task_id: task.id,
      dispatch_id: dispatch.id,
      child_session_id: options.session ?? CHILD_SESSION
    })
    if (status !== 'pending') {
      db!.transitionDelegationRequest(request.id, 'pending', status)
    }
    return request.id
  }

  const run = (folder: string, extra: Partial<BotTeamFinishReportDeps> = {}) =>
    reportFinishedBotTeamTask(db!, BOT_SESSION, { folderOf: () => folder, settleMs: 0, ...extra })

  const lastAttachmentNames = (teamId: string) =>
    db!
      .listBotTeamMessages(teamId)
      .at(-1)
      ?.attachments?.map((file) => file.name)

  describe('the wait for child delegations', () => {
    it('holds the report while a child of the session still runs, then reports on the idle after it ends', async () => {
      const { team, folder } = setup(false)
      writeFileSync(path.join(folder, 'informe.pdf'), 'x')
      const requestId = child('started')

      await run(folder)
      expect(db!.listBotTeamMessages(team.id)).toHaveLength(0)

      db!.transitionDelegationRequest(requestId, 'started', 'finished')
      await run(folder)
      const posted = db!.listBotTeamMessages(team.id)
      expect(posted).toHaveLength(1)
      expect(posted[0].text).toContain('informe.pdf')
    })

    it.each(['failed', 'cancelled'] as const)(
      'does not hold the report for a %s child',
      async (status) => {
        const { team, folder } = setup(false)
        writeFileSync(path.join(folder, 'informe.pdf'), 'x')
        child(status)

        await run(folder)
        expect(db!.listBotTeamMessages(team.id)).toHaveLength(1)
      }
    )

    it('does not hold the report for a child stuck on a card that no person answers in a bot run', async () => {
      const { team, folder } = setup(false)
      writeFileSync(path.join(folder, 'informe.pdf'), 'x')
      const requestId = child('pending')
      db!.patchDelegationRequest(requestId, { question_item_id: 'question-1' })

      await run(folder)
      expect(db!.listBotTeamMessages(team.id)).toHaveLength(1)
    })

    it('leaves a session that runs no bot task alone, child or not', async () => {
      const { team, folder } = setup(false)
      writeFileSync(path.join(folder, 'informe.pdf'), 'x')
      child('started', { parent: 'plain-session' })

      await reportFinishedBotTeamTask(db!, 'plain-session', { folderOf: () => folder, settleMs: 0 })
      expect(db!.listBotTeamMessages(team.id)).toHaveLength(0)
    })
  })

  describe('chat visuals and child files of a team with Workspaces', () => {
    it('attaches the HTML the bot wrote to its chat-visuals folder, and no other kind of file', async () => {
      const { team, folder } = setup(true)
      const visuals = path.join(root, 'visuals')
      mkdirSync(visuals)
      writeFileSync(path.join(visuals, 'impacto.html'), '<html></html>')
      writeFileSync(path.join(visuals, 'notas.txt'), 'x')

      await run(folder, { visualsFolderOf: () => visuals })
      expect(lastAttachmentNames(team.id)).toEqual(['impacto.html'])
    })

    it('reaches an HTML file that newer files of other kinds would push out of the list', async () => {
      const { team, folder } = setup(true)
      const visuals = path.join(root, 'visuals')
      mkdirSync(visuals)
      const html = path.join(visuals, 'impacto.html')
      writeFileSync(html, '<html></html>')
      const earlier = new Date(Date.now() - 500)
      utimesSync(html, earlier, earlier)
      for (let n = 0; n < 12; n += 1) {
        writeFileSync(path.join(visuals, `nota-${n}.txt`), 'x')
      }

      await run(folder, { visualsFolderOf: () => visuals })
      expect(lastAttachmentNames(team.id)).toEqual(['impacto.html'])
    })

    it("attaches an HTML a finished child lists in its result.filesModified, from the child's chat-visuals folder", async () => {
      const { team, folder } = setup(true)
      const childVisuals = path.join(root, 'child-visuals')
      const prototype = path.join(childVisuals, 'prototypes', 'req-1', 'A.html')
      mkdirSync(path.dirname(prototype), { recursive: true })
      writeFileSync(prototype, '<html></html>')
      child('finished', { result: { provenance: 'worker_report', filesModified: [prototype] } })

      await run(folder, {
        visualsFolderOf: (sessionId) =>
          sessionId === CHILD_SESSION ? childVisuals : path.join(root, 'none')
      })
      expect(lastAttachmentNames(team.id)).toEqual(['A.html'])
    })

    it("attaches a teammate's file listed in its result.filesModified only when it sits inside the teammate's worktree", async () => {
      const { team, folder } = setup(true)
      const worktree = path.join(root, 'teammate-worktree')
      mkdirSync(worktree)
      const inside = path.join(worktree, 'guia.md')
      writeFileSync(inside, 'x')
      const outside = path.join(root, 'elsewhere', 'notas-fuera.md')
      mkdirSync(path.dirname(outside))
      writeFileSync(outside, 'x')
      child('finished', {
        result: { provenance: 'worker_report', filesModified: [inside, outside] },
        session: TEAMMATE_SESSION
      })

      await run(folder, {
        visualsFolderOf: () => path.join(root, 'none'),
        workspaceOfSession: (sessionId) => (sessionId === TEAMMATE_SESSION ? 'ws-teammate' : null),
        worktreeOf: (workspaceId) =>
          workspaceId === 'ws-teammate' ? { path: worktree, local: true } : null
      })
      expect(lastAttachmentNames(team.id)).toEqual(['guia.md'])
    })
  })
})
