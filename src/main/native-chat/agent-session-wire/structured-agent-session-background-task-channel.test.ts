// The strip channel always answers a conversation's roster from the host's child records; each
// subscriber's frames carry it (see structured-agent-session-subscribers.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChildWorkView } from '../../../shared/agent-status-child-work-view'
import { StructuredAgentSessionBackgroundTaskChannel } from './structured-agent-session-background-task-channel'
import { StructuredAgentSessionConversations } from './structured-agent-session-conversations'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from './structured-agent-session-host-types'
import type { AgentSessionSubscribers } from './structured-agent-session-subscribers'
import { recordingStructuredAgentSessionLogger } from './structured-agent-session-logger-test-support'
import {
  _resetWorktreeSetupRunRegistryForTest,
  bindWorktreeSetupRunsToSession,
  registerWorktreeSetupRun,
  settleWorktreeSetupRunPty
} from '../../worktree-setup/setup-run-registry'

const child: AgentChildWorkView = {
  id: 'child-1',
  providerId: 'task-1',
  kind: 'agent',
  state: 'working',
  membership: 'live',
  firstObservedAt: 1,
  observedAt: 1,
  stoppable: true,
  invocation: { invocationId: 'spawn-1', generation: 1 }
}

type Stops = { supportsTaskStop: boolean; supportsStopAll: boolean } | undefined

function channelOver(
  children: () => AgentChildWorkView[] = () => [child],
  stops: () => Stops = () => ({ supportsTaskStop: true, supportsStopAll: true })
) {
  const sessions = new StructuredAgentSessionConversations({
    deliver: () => {},
    logger: recordingStructuredAgentSessionLogger().logger,
    now: () => 1
  })
  const republished = vi.fn()
  const channel = new StructuredAgentSessionBackgroundTaskChannel(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the channel reads only the record store's fence and the adapter's stop capability.
    {
      store: { getRecord: () => null },
      adapter: { backgroundTaskStops: stops }
    } as unknown as StructuredAgentSessionHostDeps,
    sessions,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: publish sends through `republishBackgroundTasks` only.
    { republishBackgroundTasks: republished } as unknown as AgentSessionSubscribers,
    async () => {
      throw new Error('not opened here')
    },
    { readChildWork: children, readChildWorkHistory: children }
  )
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the map reads only the journal's commit observer and the session's provider.
  const session = {
    journal: { observeCommits: () => {}, stopMarks: { observeSettleEdges: () => {} } },
    params: { provider: 'claude' }
  } as unknown as StructuredAgentSessionHostSession
  return { sessions, republished, channel, session }
}

describe('the background-task channel', () => {
  it('lists running children with the stops the live provider offers', () => {
    const { sessions, channel, session } = channelOver()
    sessions.set('session-1', session)

    expect(channel.read('session-1')).toMatchObject({
      state: 'monitoring',
      supportsTaskStop: true,
      children: [child]
    })
  })

  it('states a provider that cannot stop a task as an explicit false, not an absent field', () => {
    const { sessions, channel, session } = channelOver(undefined, () => ({
      supportsTaskStop: false,
      supportsStopAll: false
    }))
    sessions.set('session-1', session)

    expect(channel.read('session-1')).toMatchObject({
      state: 'monitoring',
      supportsTaskStop: false,
      supportsStopAll: false,
      children: [child]
    })
  })

  it('states no targeted stop for a live session whose provider offers none at all', () => {
    const { sessions, channel, session } = channelOver(undefined, () => undefined)
    sessions.set('session-1', session)

    expect(channel.read('session-1')).toMatchObject({
      state: 'monitoring',
      supportsTaskStop: false,
      supportsStopAll: false
    })
  })

  // A task that finished while no pane listened, then an idle sweep that stopped the provider:
  // a pane resuming must read "none", not silence it would take as "unchanged" (#24227).
  it('answers "none" for a conversation no provider holds, not "unknown"', () => {
    const { sessions, channel, session } = channelOver(
      () => [],
      () => undefined
    )
    sessions.set('session-1', session)

    expect(channel.read('session-1')).toBeNull()
  })

  // Claude's release path settles the last child after the adapter let go of the session, so no
  // provider answers for it any more: the strip must still hide.
  it('hides the strip when its last child settles after the provider let go of the session', () => {
    let views: AgentChildWorkView[] = [child]
    let held: Stops = { supportsTaskStop: true, supportsStopAll: true }
    const { sessions, channel, session } = channelOver(
      () => views,
      () => held
    )
    sessions.set('session-1', session)
    expect(channel.read('session-1')?.children).toHaveLength(1)

    held = undefined
    views = [{ ...child, state: 'done', membership: 'settled', outcome: 'unknown', settledAt: 2 }]
    expect(channel.read('session-1')).toBeNull()
  })

  it('republishes only for an open conversation', () => {
    const { sessions, republished, channel, session } = channelOver()
    channel.publish('session-1')
    expect(republished).not.toHaveBeenCalled()

    sessions.set('session-1', session)
    channel.publish('session-1')
    expect(republished).toHaveBeenCalledWith('session-1', expect.any(Number))
  })
})

describe('the background-task channel with Orca setup rows', () => {
  afterEach(() => {
    _resetWorktreeSetupRunRegistryForTest()
  })

  it('answers a roster for a chat whose only rows are its worktree setup run', () => {
    const { sessions, channel, session } = channelOver(
      () => [],
      () => undefined
    )
    sessions.set('session-1', session)
    registerWorktreeSetupRun({ ptyId: 'pty-1', worktreeId: 'wt-1', startedAt: 5 })
    bindWorktreeSetupRunsToSession({ worktreeId: 'wt-1', sessionId: 'session-1' })

    expect(channel.read('session-1')).toMatchObject({
      state: 'monitoring',
      tasks: [
        {
          id: 'worktree-setup:pty-1',
          kind: 'command',
          origin: 'orca',
          state: 'working',
          startedAt: 5,
          stoppable: true
        }
      ]
    })
  })

  it('moves a finished setup run to settledTasks with its exit code, and republishes the chat', () => {
    const { sessions, republished, channel, session } = channelOver(
      () => [],
      () => undefined
    )
    sessions.set('session-1', session)
    registerWorktreeSetupRun({ ptyId: 'pty-1', worktreeId: 'wt-1', startedAt: 5 })
    bindWorktreeSetupRunsToSession({ worktreeId: 'wt-1', sessionId: 'session-1' })
    republished.mockClear()

    settleWorktreeSetupRunPty('pty-1', 2, 9)

    expect(republished).toHaveBeenCalledWith('session-1', expect.any(Number))
    expect(channel.read('session-1')).toMatchObject({
      state: 'monitoring',
      settledTasks: [
        { id: 'worktree-setup:pty-1', origin: 'orca', state: 'done', exitCode: 2, stoppable: false }
      ]
    })
    expect(channel.read('session-1')?.tasks).toBeUndefined()
  })

  it('leaves a session on another worktree with no roster', () => {
    const { sessions, channel, session } = channelOver(
      () => [],
      () => undefined
    )
    sessions.set('session-1', session)
    registerWorktreeSetupRun({ ptyId: 'pty-1', worktreeId: 'wt-other', startedAt: 5 })
    bindWorktreeSetupRunsToSession({ worktreeId: 'wt-other', sessionId: 'session-2' })

    expect(channel.read('session-1')).toBeNull()
  })
})
