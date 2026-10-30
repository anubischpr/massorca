import { beforeEach, describe, expect, it } from 'vitest'
import { setTool } from '../../../src/shared/prototype-set-state'
import {
  createMobileSetState,
  mobilePrototypeStateKey,
  useMobilePrototypeViewStore
} from './mobile-prototype-view-store'

describe('mobile prototype view store', () => {
  beforeEach(() => {
    useMobilePrototypeViewStore.setState({ scope: 'all', filter: 'all', states: {} })
  })

  it('opens a set on the phone viewport, annotating, on its first direction', () => {
    const state = createMobileSetState(['B', 'C'])
    expect(state).toMatchObject({ viewport: 'phone', tool: 'annotate', active: 'B', view: 'B' })
  })

  it('keeps the state of a set that already has one', () => {
    const key = mobilePrototypeStateKey('host-1', 'req-1')
    const store = useMobilePrototypeViewStore.getState()
    store.ensureSetState(key, ['A', 'B'])
    store.updateSetState(key, (state) => setTool(state, 'browse'))
    useMobilePrototypeViewStore.getState().ensureSetState(key, ['A', 'B'])
    expect(useMobilePrototypeViewStore.getState().states[key]?.tool).toBe('browse')
  })

  it('keys a set by host, as request ids are only unique on one host', () => {
    expect(mobilePrototypeStateKey('host-1', 'req-1')).not.toBe(
      mobilePrototypeStateKey('host-2', 'req-1')
    )
  })

  it('ignores an update to a set it has no state for', () => {
    useMobilePrototypeViewStore.getState().updateSetState('missing', (state) => state)
    expect(useMobilePrototypeViewStore.getState().states).toEqual({})
  })
})

describe('mobile prototype view store merge', () => {
  it('makes the merged direction the main once the set lists it, and clears the stars', () => {
    const key = mobilePrototypeStateKey('host-1', 'req-merge')
    const store = useMobilePrototypeViewStore.getState()
    store.ensureSetState(key, ['A', 'B', 'C'])
    store.updateSetState(key, (state) => ({
      ...state,
      starred: ['A', 'C'],
      mergeInto: { letter: 'D', from: ['A', 'C'] }
    }))

    useMobilePrototypeViewStore.getState().ensureSetState(key, ['A', 'B', 'C'])
    expect(useMobilePrototypeViewStore.getState().states[key]).toMatchObject({
      active: 'A',
      starred: ['A', 'C']
    })

    useMobilePrototypeViewStore.getState().ensureSetState(key, ['A', 'B', 'C', 'D'])
    expect(useMobilePrototypeViewStore.getState().states[key]).toMatchObject({
      active: 'D',
      view: 'D',
      starred: [],
      mergeInto: null,
      mergedFrom: { D: ['A', 'C'] }
    })
  })
})

describe('mobile prototype view store letters', () => {
  it('moves an iterated letter the set no longer has to its first direction, and keeps the state', () => {
    const key = mobilePrototypeStateKey('host-1', 'req-letters')
    const store = useMobilePrototypeViewStore.getState()
    store.ensureSetState(key, ['A', 'B'])
    store.updateSetState(key, (state) => ({ ...state, active: 'B', view: 'B', prompt: 'keep' }))
    store.ensureSetState(key, ['A'])
    expect(useMobilePrototypeViewStore.getState().states[key]).toMatchObject({
      active: 'A',
      view: 'A',
      prompt: 'keep',
      viewport: 'phone'
    })
  })
})
