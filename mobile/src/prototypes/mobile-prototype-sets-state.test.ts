import { describe, expect, it } from 'vitest'
import {
  LOADING_PROTOTYPE_SETS,
  findMobilePrototypeSet,
  nextMobilePrototypeSetsState
} from './mobile-prototype-sets-state'
import { listedSet } from './mobile-prototype-sets.test-fixture'

describe('nextMobilePrototypeSetsState', () => {
  it('takes the sets the host listed', () => {
    const sets = [listedSet()]
    expect(nextMobilePrototypeSetsState(LOADING_PROTOTYPE_SETS, { kind: 'ready', sets })).toEqual({
      status: 'ready',
      sets
    })
  })

  it('keeps the sets already shown when the host cannot be reached', () => {
    const shown = { status: 'ready' as const, sets: [listedSet()] }
    expect(nextMobilePrototypeSetsState(shown, { kind: 'unreachable' })).toEqual({
      status: 'unreachable',
      sets: shown.sets
    })
  })

  it('says an older host cannot list, without inventing an empty list', () => {
    expect(
      nextMobilePrototypeSetsState(LOADING_PROTOTYPE_SETS, { kind: 'unsupported-host' })
    ).toEqual({ status: 'unsupported-host', sets: [] })
  })
})

describe('findMobilePrototypeSet', () => {
  it('finds the set a screen was opened for', () => {
    const set = listedSet({ requestId: 'req-1' })
    const state = { status: 'ready' as const, sets: [listedSet({ requestId: 'req-0' }), set] }
    expect(findMobilePrototypeSet(state, 'req-1')).toBe(set)
    expect(findMobilePrototypeSet(state, 'req-9')).toBeNull()
  })
})
