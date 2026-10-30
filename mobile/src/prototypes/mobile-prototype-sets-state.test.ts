import { describe, expect, it } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../src/shared/rpc-contract/prototype-params'
import {
  LOADING_PROTOTYPE_SETS,
  findMobilePrototypeDesignSystem,
  findMobilePrototypeSet,
  nextMobilePrototypeSetsState
} from './mobile-prototype-sets-state'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: '/work/nexuscare',
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 24,
  swatches: ['#1d4ed8', '#e5e5e5', '#737373', '#16a34a']
}

describe('nextMobilePrototypeSetsState', () => {
  it('takes the sets and design systems the host listed', () => {
    const sets = [listedSet()]
    expect(
      nextMobilePrototypeSetsState(LOADING_PROTOTYPE_SETS, {
        kind: 'ready',
        sets,
        designSystems: [SYSTEM]
      })
    ).toEqual({ status: 'ready', sets, designSystems: [SYSTEM] })
  })

  it('reads a host that sends no design systems as having none', () => {
    const sets = [listedSet()]
    expect(nextMobilePrototypeSetsState(LOADING_PROTOTYPE_SETS, { kind: 'ready', sets })).toEqual({
      status: 'ready',
      sets,
      designSystems: []
    })
  })

  it('keeps the sets and systems already shown when the host cannot be reached', () => {
    const shown = { status: 'ready' as const, sets: [listedSet()], designSystems: [SYSTEM] }
    expect(nextMobilePrototypeSetsState(shown, { kind: 'unreachable' })).toEqual({
      status: 'unreachable',
      sets: shown.sets,
      designSystems: shown.designSystems
    })
  })

  it('says an older host cannot list, without inventing an empty list', () => {
    expect(
      nextMobilePrototypeSetsState(LOADING_PROTOTYPE_SETS, { kind: 'unsupported-host' })
    ).toEqual({ status: 'unsupported-host', sets: [], designSystems: [] })
  })
})

describe('findMobilePrototypeSet', () => {
  it('finds the set a screen was opened for', () => {
    const set = listedSet({ requestId: 'req-1' })
    const state = {
      status: 'ready' as const,
      sets: [listedSet({ requestId: 'req-0' }), set],
      designSystems: []
    }
    expect(findMobilePrototypeSet(state, 'req-1')).toBe(set)
    expect(findMobilePrototypeSet(state, 'req-9')).toBeNull()
  })
})

describe('findMobilePrototypeDesignSystem', () => {
  it('finds the system of the project a screen was opened for', () => {
    const state = { status: 'ready' as const, sets: [], designSystems: [SYSTEM] }
    expect(findMobilePrototypeDesignSystem(state, '/work/nexuscare')).toBe(SYSTEM)
    expect(findMobilePrototypeDesignSystem(state, '/work/other')).toBeNull()
  })
})
