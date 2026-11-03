import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  AgentSessionStatusEvent,
  AgentSessionStatusSummary
} from '../../shared/agent-session-wire'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { listBotTeamVersions } from './bot-team-snapshots'
import { saveVersionOfFinishedTask } from './bot-team-task-versions'
import { watchBotTeamTaskFinishes } from './bot-team-version-watcher'

function summary(
  sessionId: string,
  status: 'working' | 'idle' | 'attention',
  turnOutcome?: 'success' | 'failure' | 'cancellation' | 'interruption'
): AgentSessionStatusSummary {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the watcher reads only the id, the status and the outcome.
  return { sessionId, status, ...(turnOutcome ? { turnOutcome } : {}) } as AgentSessionStatusSummary
}

function feed() {
  let emit: (event: AgentSessionStatusEvent) => void = () => {}
  const finished: string[] = []
  const stop = watchBotTeamTaskFinishes(
    {
      subscribeStatus: (subscriber) => {
        emit = subscriber.emit
        return () => {}
      }
    },
    (sessionId) => finished.push(sessionId)
  )
  return {
    finished,
    stop,
    snapshot: (...sessions: AgentSessionStatusSummary[]) => emit({ type: 'snapshot', sessions }),
    status: (session: AgentSessionStatusSummary) => emit({ type: 'status', session })
  }
}

describe('watching for a finished task', () => {
  it('reports a session that turns from running to done, once', () => {
    const events = feed()
    events.snapshot(summary('s1', 'idle'))
    events.status(summary('s1', 'working'))
    events.status(summary('s1', 'working'))
    events.status(summary('s1', 'idle', 'success'))
    events.status(summary('s1', 'idle', 'success'))
    expect(events.finished).toEqual(['s1'])
  })

  it('reports it again when the task is continued and finishes again', () => {
    const events = feed()
    events.status(summary('s1', 'working'))
    events.status(summary('s1', 'idle'))
    events.status(summary('s1', 'working'))
    events.status(summary('s1', 'idle'))
    expect(events.finished).toEqual(['s1', 's1'])
  })

  it('ignores what ended before the watcher, a stop and a failure', () => {
    const events = feed()
    events.snapshot(summary('old', 'idle', 'success'), summary('busy', 'working'))
    events.status(summary('old', 'idle', 'success'))
    events.status(summary('busy', 'idle', 'cancellation'))
    events.status(summary('other', 'working'))
    events.status(summary('other', 'idle', 'failure'))
    events.status(summary('third', 'working'))
    events.status(summary('third', 'idle', 'interruption'))
    expect(events.finished).toEqual([])
  })

  it('counts a turn that waited for the person and then finished', () => {
    const events = feed()
    events.status(summary('s1', 'attention'))
    events.status(summary('s1', 'idle', 'success'))
    expect(events.finished).toEqual(['s1'])
  })
})

describe('saving a version for a finished task', () => {
  let root: string | undefined
  let db: OrchestrationDb | undefined

  afterEach(async () => {
    db?.close()
    db = undefined
    if (root) {
      await rm(root, { recursive: true, force: true })
    }
    root = undefined
  })

  it('names the task and the bot that owned it, and leaves other sessions alone', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'bot-team-task-version-'))
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer for June',
      prompt: 'Make it',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    const folder = path.join(root, 'folder')
    await mkdir(folder)
    await writeFile(path.join(folder, 'flyer.html'), '<p>June</p>')
    const deps = { folder, storeDir: path.join(root, 'versions', 'team') }

    await saveVersionOfFinishedTask(db, 'unknown-session', () => deps)
    expect(await listBotTeamVersions(deps)).toEqual([])

    await saveVersionOfFinishedTask(db, 'session-1', () => deps)
    expect(await listBotTeamVersions(deps)).toEqual([
      expect.objectContaining({
        label: 'Flyer for June',
        author: 'Iris',
        reason: 'task-finished'
      })
    ])
  })

  it('does nothing when the team has no folder yet', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'bot-team-task-version-'))
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make it',
      ownerBotId: team.bots[0].id
    })
    db.setBotTeamTaskSession(task.id, 'session-1')
    const deps = { folder: path.join(root, 'missing'), storeDir: path.join(root, 'v') }
    await saveVersionOfFinishedTask(db, 'session-1', () => deps)
    expect(await listBotTeamVersions(deps)).toEqual([])
  })
})
