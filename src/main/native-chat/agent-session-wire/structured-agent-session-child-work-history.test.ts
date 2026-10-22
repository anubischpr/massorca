// A chat keeps the finished children its Subagents and Background tasks cards list: across the
// user's next turn, time, a client reconnecting, and a host restart.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session-journal-types'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import type { AgentChildWorkEvidence } from '../../../shared/agent-status-child-work-evidence'
import type { AgentChildWorkView } from '../../../shared/agent-status-child-work-view'
import { acpChildWorkStatusSink } from '../../acp/acp-structured-child-work.test-support'
import { writeAgentSessionStoreRows } from '../../runtime/agent-session-record-rows'
import {
  childWorkHistoryRowsIn,
  readChildWorkHistoryRow
} from '../agent-session-journal/child-work-history-rows'
import {
  closeTestJournalHostDatabase,
  createTrackedJournalOpener,
  openTestJournalHostDatabase
} from '../agent-session-journal/journal-host-database-test-support'
import {
  MAX_SETTLED_CHILD_WORK_PER_KIND,
  StructuredAgentSessionChildWorkHistory
} from './structured-agent-session-child-work-history'
import { createStructuredAgentSessionLogger } from './structured-agent-session-logger'
import { StructuredAgentSessionStatusFeed } from './structured-agent-session-status-feed'
import {
  indexedStatusFeedSession,
  statusFeedChildView as childView
} from './structured-agent-session-status-feed-test-session'

const SESSION = 'history-session'
const DAY_MS = 24 * 60 * 60 * 1000
const USER_IDENTITY = {
  provider: 'codex',
  threadId: 'thread-1',
  turnId: 'turn-1',
  ordinal: 1
} as const

let root: string
const journals = createTrackedJournalOpener()

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-child-work-history-'))
})

afterEach(async () => {
  await journals.closeAll()
  await rm(root, { recursive: true, force: true })
})

function historyOver(stateDirectory: string) {
  return new StructuredAgentSessionChildWorkHistory(
    childWorkHistoryRowsIn(openTestJournalHostDatabase(stateDirectory))
  )
}

/** The host stops: its database closes, and the next history opens the same file afresh. */
function restart(stateDirectory: string) {
  closeTestJournalHostDatabase(stateDirectory)
  return historyOver(stateDirectory)
}

function settled(id: string, over: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return childView({
    id,
    providerId: `task-${id}`,
    membership: 'settled',
    state: 'done',
    outcome: 'succeeded',
    settledAt: 500,
    ...over
  })
}

async function feedOverRealStore(
  stateDirectory: string,
  history: StructuredAgentSessionChildWorkHistory
) {
  const journal = await journals.open({
    identity: {
      sessionId: SESSION,
      workspaceId: 'workspace-1',
      hostId: 'local',
      agent: 'codex',
      providerHandle: codexProviderHandle('thread-1')
    },
    stateDirectory
  })
  const { sink } = acpChildWorkStatusSink()
  let now = 1_000
  const clock = { advance: (ms: number) => (now += ms) }
  const feed = new StructuredAgentSessionStatusFeed({
    logger: createStructuredAgentSessionLogger(),
    sessions: new Map([[SESSION, indexedStatusFeedSession({ journal })]]),
    getRecord: () => null,
    now: () => now,
    statusSink: () => sink,
    childWorkHistory: history
  })
  await journal.appendItem(
    USER_IDENTITY,
    { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'fan out' }] },
    { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  feed.publish(SESSION, journal)
  /** What a client reads: the store's records with the history. */
  const read = () => history.compose(SESSION, feed.readChildWork(SESSION, true) ?? [])
  return { feed, clock, journal, read }
}

function agentLive(taskId: string, observedAt: number): AgentChildWorkEvidence {
  return {
    type: 'live',
    observedAt,
    child: {
      handle: { idKind: 'task_id', id: taskId },
      kind: 'agent',
      residency: 'background',
      state: 'working',
      name: `agent ${taskId}`,
      stoppable: true
    }
  }
}

function agentEnded(taskId: string, observedAt: number): AgentChildWorkEvidence {
  return {
    type: 'ended',
    observedAt,
    handle: { idKind: 'task_id', id: taskId },
    outcome: 'succeeded'
  }
}

describe('finished child work history', () => {
  it('keeps a finished child through the next turn and the passing of time', async () => {
    const dir = join(root, 'next-turn')
    const { feed, clock, read } = await feedOverRealStore(dir, historyOver(dir))
    feed.publishChildWork(SESSION, [agentLive('a1', 1_100), agentEnded('a1', 1_200)])
    expect(read()).toEqual([
      expect.objectContaining({ providerId: 'a1', membership: 'settled', outcome: 'succeeded' })
    ])

    // The user's next send: the store drops its settled children on this edge.
    feed.publishChildWork(SESSION, [{ type: 'turn-started', observedAt: clock.advance(1) }])
    expect(feed.readChildWork(SESSION, true)).toEqual([])
    clock.advance(90 * DAY_MS)
    feed.publishChildWork(SESSION, [agentLive('a2', clock.advance(1))])

    expect(read()).toEqual([
      expect.objectContaining({ providerId: 'a2', membership: 'live' }),
      expect.objectContaining({ providerId: 'a1', membership: 'settled', outcome: 'succeeded' })
    ])
  })

  it('replays the history to a client that subscribes after a host restart', async () => {
    const dir = join(root, 'restart')
    const first = await feedOverRealStore(dir, historyOver(dir))
    first.feed.publishChildWork(SESSION, [
      agentLive('done-1', 1_100),
      agentEnded('done-1', 1_200),
      agentLive('running-1', 1_300)
    ])
    await first.journal.close()

    const second = await feedOverRealStore(dir, restart(dir))
    const replayed = second.read()
    expect(replayed).toEqual([
      expect.objectContaining({ providerId: 'done-1', outcome: 'succeeded' }),
      // The host that ran it is gone: finished, never running, and nobody reported how.
      expect.objectContaining({
        providerId: 'running-1',
        membership: 'settled',
        state: 'done',
        outcome: 'unknown',
        stoppable: false
      })
    ])
  })

  it('shows a child the provider reattaches as running, not as its interrupted copy', async () => {
    const dir = join(root, 'reattach')
    const first = await feedOverRealStore(dir, historyOver(dir))
    first.feed.publishChildWork(SESSION, [agentLive('running-1', 1_100)])
    await first.journal.close()

    const second = await feedOverRealStore(dir, restart(dir))
    second.feed.publishChildWork(SESSION, [agentLive('running-1', 2_000)])
    expect(second.read()).toEqual([
      expect.objectContaining({ providerId: 'running-1', membership: 'live' })
    ])
  })

  it('ends a child still running when its session is let go as interrupted', async () => {
    const dir = join(root, 'forget')
    const { feed, read } = await feedOverRealStore(dir, historyOver(dir))
    feed.publishChildWork(SESSION, [agentLive('running-1', 1_100)])
    feed.forget(SESSION)
    expect(read()).toEqual([
      expect.objectContaining({
        providerId: 'running-1',
        membership: 'settled',
        outcome: 'unknown'
      })
    ])
  })
})

describe('history bound', () => {
  it('keeps the newest per kind and leaves other kinds alone', () => {
    const dir = join(root, 'bound')
    const history = historyOver(dir)
    const agents = Array.from({ length: MAX_SETTLED_CHILD_WORK_PER_KIND + 10 }, (_, index) =>
      settled(`agent-${index}`, { settledAt: 1_000 + index })
    )
    const commands = [settled('command-1', { kind: 'command', settledAt: 10 })]
    history.observe(SESSION, [...agents, ...commands])

    const kept = history.compose(SESSION, [])
    expect(kept.filter((view) => view.kind === 'agent')).toHaveLength(
      MAX_SETTLED_CHILD_WORK_PER_KIND
    )
    expect(kept.map((view) => view.id)).not.toContain('agent-0')
    expect(kept.map((view) => view.id)).toContain('agent-59')
    expect(kept.map((view) => view.id)).toContain('command-1')

    // The stored row honours the same bound.
    const reopened = restart(dir)
    expect(reopened.compose(SESSION, [])).toHaveLength(MAX_SETTLED_CHILD_WORK_PER_KIND + 1)
  })

  it('drops an owner reference the history no longer holds', () => {
    const history = historyOver(join(root, 'owner'))
    history.observe(SESSION, [
      settled('child-1', { parentChildWorkId: 'gone', ownership: 'child' })
    ])
    const [view] = history.compose(SESSION, [])
    expect(view).not.toHaveProperty('parentChildWorkId')
    expect(view).toMatchObject({ ownership: 'unverifiable' })
  })
})

describe('history row', () => {
  it('goes with the chat record', () => {
    const dir = join(root, 'deleted-chat')
    const database = openTestJournalHostDatabase(dir)
    const history = new StructuredAgentSessionChildWorkHistory(childWorkHistoryRowsIn(database))
    history.observe(SESSION, [settled('child-1')])
    expect(readChildWorkHistoryRow(database.db, SESSION)).not.toBeNull()

    database.transaction((db) =>
      writeAgentSessionStoreRows(db, {
        records: { upsert: [], remove: [SESSION] },
        operations: { upsert: [], remove: [] },
        retiredClaimKeys: null,
        sessionTabs: null
      })
    )
    expect(readChildWorkHistoryRow(database.db, SESSION)).toBeNull()
  })
})
