import { describe, expect, it } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../src/shared/rpc-contract/prototype-params'
import {
  hostListsDesignSystems,
  listMobilePrototypeSets
} from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import { buildMobilePrototypeGroups } from './mobile-prototype-list-model'
import { FIXTURE_NOW, listedSet } from './mobile-prototype-sets.test-fixture'
import { LOADING_PROTOTYPE_SETS, nextMobilePrototypeSetsState } from './mobile-prototype-sets-state'

const PROJECT = '/work/nexuscare'
const SESSION = 'session-alpha-0001'

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: PROJECT,
  projectName: 'nexuscare',
  status: 'detected',
  version: 3,
  tokenCount: 42,
  swatches: ['#112233', '#445566']
}

/** A client whose only answer is one `prototypes.list` reply, the way the host sends it. */
function clientReplying(result: unknown): RpcClient {
  return {
    sendRequest: async () => ({ ok: true as const, result }),
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
}

/** The list a screen would draw from one reply: the listing, then its groups, under "All agents". */
async function groupsOf(client: RpcClient) {
  const listed = nextMobilePrototypeSetsState(
    LOADING_PROTOTYPE_SETS,
    await listMobilePrototypeSets(client, {})
  )
  const groups = buildMobilePrototypeGroups({
    sets: listed.sets,
    designSystems: listed.designSystems,
    scope: 'all',
    sessionId: null,
    filter: 'all',
    activeLetterOf: () => undefined,
    nowMs: FIXTURE_NOW
  })
  return { listed, groups }
}

describe('the project groups of a listing that carries projects and design systems', () => {
  it('titles each project, pins its design system, and marks the host as listing them', async () => {
    const client = clientReplying({
      sets: [listedSet({ sessionId: SESSION, projectKey: PROJECT, projectName: 'nexuscare' })],
      designSystems: [SYSTEM]
    })
    const { groups } = await groupsOf(client)

    expect(hostListsDesignSystems(client)).toBe(true)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.projectKey).toBe(PROJECT)
    expect(groups[0]?.projectName).toBe('nexuscare')
    expect(groups[0]?.system).toEqual(SYSTEM)
    expect(groups[0]?.rows).toHaveLength(1)
  })

  it('names a project from its design system when its sets carry no name', async () => {
    const client = clientReplying({
      sets: [listedSet({ sessionId: SESSION, projectKey: PROJECT })],
      designSystems: [SYSTEM]
    })
    const { groups } = await groupsOf(client)

    expect(groups[0]?.projectName).toBe('nexuscare')
  })

  it('keeps only the project of this chat under "This chat"', async () => {
    const client = clientReplying({
      sets: [
        listedSet({ sessionId: SESSION, projectKey: PROJECT, projectName: 'nexuscare' }),
        listedSet({
          requestId: '20261028-180000-cccccc',
          sessionId: 'session-beta-0002',
          projectKey: '/work/landing-site',
          projectName: 'landing-site'
        })
      ],
      designSystems: [SYSTEM]
    })
    const { listed } = await groupsOf(client)
    const groups = buildMobilePrototypeGroups({
      sets: listed.sets,
      designSystems: listed.designSystems,
      scope: 'chat',
      sessionId: SESSION,
      filter: 'all',
      activeLetterOf: () => undefined,
      nowMs: FIXTURE_NOW
    })

    expect(groups.map((group) => group.projectName)).toEqual(['nexuscare'])
    expect(groups[0]?.system).toEqual(SYSTEM)
  })

  it('shows no design system row for a host whose listing does not carry them', async () => {
    const client = clientReplying({
      sets: [listedSet({ sessionId: SESSION, projectKey: PROJECT, projectName: 'nexuscare' })]
    })
    const { groups } = await groupsOf(client)

    expect(hostListsDesignSystems(client)).toBe(false)
    expect(groups[0]?.projectName).toBe('nexuscare')
    expect(groups[0]?.system).toBeNull()
  })
})
