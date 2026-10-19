import { describe, expect, it } from 'vitest'
import type {
  AgentSessionHistoryResult,
  AgentSessionSubscribeEvent
} from '../../../../shared/agent-session-wire'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES } from '../../../../shared/electron-remote-runtime-client-capabilities'
import {
  AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES
} from '../../../../shared/structured-agent-session-surface-capabilities'
import { DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES } from '../../../ipc/desktop-renderer-runtime-capabilities'
import {
  projectSettledChildWorkEvent,
  projectSettledChildWorkHistory
} from './structured-agent-session-settled-child-work-capability'

function child(id: string, overrides: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    kind: 'command',
    description: `task ${id}`,
    state: 'working',
    membership: 'live',
    firstObservedAt: 100,
    observedAt: 500,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 },
    ...overrides
  }
}

const running = child('run')
const finished = child('done', { state: 'done', membership: 'settled', settledAt: 400 })
const activity = [running, finished]

const page = {
  sessionId: 's',
  epoch: 'e',
  direction: 'tail' as const,
  items: [],
  removedItemIds: [],
  submissions: [],
  window: { oldest: null, newest: null, nextCursor: { epoch: 'e', sequence: 0 } },
  liveCursor: { epoch: 'e', sequence: 0 },
  hasOlder: false,
  hasNewer: false,
  commandActivity: activity
}
const batch: AgentSessionSubscribeEvent = {
  type: 'batch',
  sessionId: 's',
  batch: { cursor: { epoch: 'e', sequence: 1 }, items: [], removedItemIds: [], submissions: [] },
  commandActivity: activity
}
const snapshot: AgentSessionSubscribeEvent = {
  type: 'snapshot',
  sessionId: 's',
  fence: 1,
  page,
  commandActivity: activity
}
const history: AgentSessionHistoryResult = { ok: true, page }

const OLD_CLIENT = { clientKind: 'runtime', clientCapabilities: [] } as const
const NEW_CLIENT = {
  clientKind: 'runtime',
  clientCapabilities: [AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY]
} as const

describe('settled child work capability', () => {
  it('is advertised by hosts and by both desktop clients that group it', () => {
    expect(STRUCTURED_AGENT_SESSION_SURFACE_RUNTIME_CAPABILITIES).toContain(
      AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY
    )
    expect(ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES).toContain(
      AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY
    )
    expect(DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES).toContain(
      AGENT_SESSION_SETTLED_CHILD_WORK_RUNTIME_CAPABILITY
    )
  })

  it('keeps finished children for in-process callers and for clients that advertise it', () => {
    for (const ctx of [{ clientKind: undefined }, NEW_CLIENT]) {
      expect(projectSettledChildWorkEvent(batch, ctx)).toBe(batch)
      expect(projectSettledChildWorkEvent(snapshot, ctx)).toBe(snapshot)
      expect(projectSettledChildWorkHistory(history, ctx)).toBe(history)
    }
  })

  it('gives a client that never advertised it running children only, in every frame', () => {
    expect(projectSettledChildWorkEvent(batch, OLD_CLIENT)).toMatchObject({
      commandActivity: [running]
    })
    expect(projectSettledChildWorkEvent(snapshot, OLD_CLIENT)).toMatchObject({
      commandActivity: [running],
      page: { commandActivity: [running] }
    })
    expect(projectSettledChildWorkHistory(history, OLD_CLIENT).page.commandActivity).toEqual([
      running
    ])
  })

  it('still lists a finished owner whose own work runs, as before', () => {
    const owner = child('owner', { state: 'done', membership: 'settled', settledAt: 300 })
    const owned = child('owned', { parentChildWorkId: 'owner' })
    const event: AgentSessionSubscribeEvent = {
      ...batch,
      commandActivity: [owner, owned, finished]
    }
    expect(projectSettledChildWorkEvent(event, OLD_CLIENT)).toMatchObject({
      commandActivity: [owner, owned]
    })
  })

  it('leaves frames that carry no child work alone', () => {
    const bare: AgentSessionSubscribeEvent = { ...batch }
    delete bare.commandActivity
    expect(projectSettledChildWorkEvent(bare, OLD_CLIENT)).toBe(bare)
    const end: AgentSessionSubscribeEvent = { type: 'end' }
    expect(projectSettledChildWorkEvent(end, OLD_CLIENT)).toBe(end)
  })
})
