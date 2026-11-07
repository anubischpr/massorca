/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// A fake of the shared status feed: its owner reconnects, so the hook must read from it.
const feed = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state = {
    snapshot: new Map() as AgentSessionStatusSnapshot,
    activations: 0,
    releases: 0
  }
  return {
    listeners,
    state,
    owner: {
      activate: () => {
        state.activations += 1
        return () => {
          state.releases += 1
        }
      },
      getSnapshot: () => state.snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }
  }
})
vi.mock('@/runtime/structured-agent-session-status-feed', () => ({
  getStructuredAgentSessionStatusFeed: () => feed.owner
}))
vi.mock('@/runtime/bot-team-host', () => ({
  useBotTeamHost: () => 'local',
  botTeamHostTarget: () => ({ kind: 'local' })
}))

const { useBotTeamSessionStatuses } = await import('./use-bot-team-task-status')

const mounted: { root: Root }[] = []
let latest: AgentSessionStatusSnapshot = new Map()

function Probe(): null {
  latest = useBotTeamSessionStatuses()
  return null
}

afterEach(() => {
  for (const { root } of mounted.splice(0)) {
    act(() => root.unmount())
  }
  feed.state.snapshot = new Map()
  feed.state.activations = 0
  feed.state.releases = 0
  feed.listeners.clear()
})

describe('the live session status a room reads', () => {
  it('follows the shared status feed, which reconnects, instead of a one-shot subscription', async () => {
    const root = createRoot(document.createElement('div'))
    mounted.push({ root })
    await act(async () => root.render(<Probe />))
    expect(feed.state.activations).toBe(1)
    expect(latest.size).toBe(0)

    await act(async () => {
      feed.state.snapshot = new Map([
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook only hands the map on; no field is read.
        ['s1', { sessionId: 's1', status: 'idle' } as never]
      ])
      for (const listener of feed.listeners) {
        listener()
      }
    })

    expect(latest.get('s1')).toBeDefined()
  })

  it('lets go of the feed when the room closes', async () => {
    const root = createRoot(document.createElement('div'))
    mounted.push({ root })
    await act(async () => root.render(<Probe />))
    await act(async () => root.unmount())
    mounted.pop()

    expect(feed.state.releases).toBe(1)
  })
})
