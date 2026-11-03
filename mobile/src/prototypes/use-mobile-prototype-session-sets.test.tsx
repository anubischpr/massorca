import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeSessionScope } from '../../../src/shared/prototype-session-sets'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'
import { useMobilePrototypeSetsOfSession } from './use-mobile-prototype-session-sets'

function listedSet(requestId: string, sessionId: string, createdAt: string): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Two directions',
    createdAt,
    count: 2,
    directions: []
  }
}

const host = vi.hoisted(() => ({ reads: 0 }))

vi.mock('../session/mobile-prototype-host-rpc', () => ({
  listMobilePrototypeSets: () => {
    host.reads += 1
    return Promise.resolve({
      kind: 'ready',
      sets: [
        listedSet('own', 'task', '2026-11-03T01:00:00.000Z'),
        listedSet('from-child', 'child-1', '2026-11-03T02:00:00.000Z'),
        listedSet('other', 'elsewhere', '2026-11-03T03:00:00.000Z')
      ]
    })
  }
}))

// The listing is mocked, so the client is only an identity the hook passes along.
const CLIENT: RpcClient = {
  sendRequest: () => Promise.reject(new Error('the listing is mocked')),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: () => {},
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => null,
  onStateChange: () => () => {},
  notifyForeground: () => {},
  close: () => {}
}

type ProbeProps = { scope: PrototypeSessionScope | null; refreshKey?: number }

const latest: { sets: readonly PrototypeListedSet[] } = { sets: [] }

function Probe({ scope, refreshKey }: ProbeProps) {
  latest.sets = useMobilePrototypeSetsOfSession({ client: CLIENT, scope, refreshKey })
  return null
}

async function mount(props: ProbeProps): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined
  await act(async () => {
    renderer = create(createElement(Probe, props))
  })
  if (renderer === undefined) {
    throw new Error('the probe did not mount')
  }
  return renderer
}

describe('useMobilePrototypeSetsOfSession', () => {
  beforeEach(() => {
    host.reads = 0
    latest.sets = []
  })

  it('lists a task session own and child sets, newest first', async () => {
    await mount({ scope: { sessionId: 'task', childSessionIds: ['child-1'] } })
    expect(latest.sets.map((set) => set.requestId)).toEqual(['from-child', 'own'])
  })

  it('lists again when the refresh key changes, not when the same scope is passed anew', async () => {
    const renderer = await mount({ scope: { sessionId: 'task' }, refreshKey: 1 })
    await act(async () => {
      renderer.update(createElement(Probe, { scope: { sessionId: 'task' }, refreshKey: 1 }))
    })
    expect(host.reads).toBe(1)
    await act(async () => {
      renderer.update(createElement(Probe, { scope: { sessionId: 'task' }, refreshKey: 2 }))
    })
    expect(host.reads).toBe(2)
  })

  it('lists nothing without a scope', async () => {
    await mount({ scope: null })
    expect(latest.sets).toEqual([])
    expect(host.reads).toBe(0)
  })
})
