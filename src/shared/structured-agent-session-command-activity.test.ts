import { describe, expect, it } from 'vitest'
import {
  EMPTY_STRUCTURED_AGENT_SESSION,
  reduceStructuredAgentSession
} from './structured-agent-session-reducer'
import type { AgentSessionHistoryPage } from './agent-session-wire'
import type { AgentChildWorkView } from './agent-status-child-work-view'
const page: AgentSessionHistoryPage = {
  sessionId: 'test',
  epoch: 'epoch',
  fence: 1,
  direction: 'tail',
  items: [],
  removedItemIds: [],
  submissions: [],
  window: { oldest: null, newest: null, nextCursor: { epoch: 'epoch', sequence: 0 } },
  liveCursor: { epoch: 'epoch', sequence: 0 },
  hasOlder: false,
  hasNewer: false
}
const command: AgentChildWorkView = {
  id: 'command',
  kind: 'command',
  membership: 'live',
  state: 'working',
  ownership: 'main',
  firstObservedAt: 1,
  observedAt: 1,
  stoppable: false,
  invocation: { invocationId: 'one', generation: 1 }
}
describe('command panel activity frames', () => {
  it('hydrates independently of the strip and clears on an unchanged-cursor batch', () => {
    const active = reduceStructuredAgentSession(EMPTY_STRUCTURED_AGENT_SESSION, {
      type: 'event',
      event: {
        type: 'snapshot',
        sessionId: 'test',
        page,
        fence: 1,
        backgroundTasks: null,
        commands: [],
        functions: [],
        commandActivity: [command]
      }
    })
    expect(active.commandActivity).toEqual([command])
    expect(active.backgroundTasks).toBeNull()
    const done = reduceStructuredAgentSession(active, {
      type: 'event',
      event: {
        type: 'batch',
        sessionId: 'test',
        batch: {
          cursor: { epoch: 'epoch', sequence: 0 },
          items: [],
          removedItemIds: [],
          submissions: []
        },
        commandActivity: []
      }
    })
    expect(done.commandActivity).toEqual([])
    expect(done.commands).toEqual([])
    expect(done.functions).toEqual([])
    const oldHost = reduceStructuredAgentSession(active, {
      type: 'event',
      event: { type: 'snapshot', sessionId: 'test', page, fence: 1 }
    })
    expect(oldHost.commandActivity).toBeUndefined()
  })
  it('keeps live activity over stale history and retains it during disconnection', () => {
    const active = reduceStructuredAgentSession(EMPTY_STRUCTURED_AGENT_SESSION, {
      type: 'event',
      event: { type: 'snapshot', sessionId: 'test', page, fence: 1, commandActivity: [command] }
    })
    const history = reduceStructuredAgentSession(active, {
      type: 'history-page',
      page: { ...page, commandActivity: [] }
    })
    expect(history.commandActivity).toEqual([command])
    expect(
      reduceStructuredAgentSession(history, { type: 'error', message: 'disconnected' })
        .commandActivity
    ).toEqual([command])
  })
})
