import { beforeEach, describe, expect, it } from 'vitest'
import { setPrompt } from '../../../../shared/prototype-set-state'
import { usePrototypeViewStore } from './prototype-view-store'

beforeEach(() => {
  usePrototypeViewStore.setState({ filter: 'all', selectedRequestId: null, states: {} })
})

describe('usePrototypeViewStore invariants', () => {
  it('creates a set state once and keeps it, draft included, on a later ensure', () => {
    const store = usePrototypeViewStore.getState()
    store.ensureSetState('r1', ['A', 'B'])
    store.updateSetState('r1', (state) => setPrompt(state, 'keep this draft'))
    store.ensureSetState('r1', ['A', 'B', 'C'])
    expect(usePrototypeViewStore.getState().states.r1).toMatchObject({
      active: 'A',
      prompt: 'keep this draft'
    })
  })

  it('moves an iterated letter the set no longer has to its first direction, and keeps the draft', () => {
    const store = usePrototypeViewStore.getState()
    store.ensureSetState('r1', ['A', 'B'])
    store.updateSetState('r1', (state) => ({
      ...setPrompt(state, 'keep this draft'),
      active: 'B',
      view: 'B'
    }))
    store.ensureSetState('r1', ['A'])
    expect(usePrototypeViewStore.getState().states.r1).toMatchObject({
      active: 'A',
      view: 'A',
      prompt: 'keep this draft'
    })
  })

  it('changes only the request an update names', () => {
    const store = usePrototypeViewStore.getState()
    store.ensureSetState('r1', ['A'])
    store.ensureSetState('r2', ['A'])
    const other = usePrototypeViewStore.getState().states.r2
    store.updateSetState('r1', (state) => setPrompt(state, 'only r1'))
    expect(usePrototypeViewStore.getState().states.r2).toBe(other)
    expect(usePrototypeViewStore.getState().states.r1?.prompt).toBe('only r1')
  })

  it('creates no state for an update to a request that was never ensured', () => {
    usePrototypeViewStore.getState().updateSetState('missing', (state) => setPrompt(state, 'x'))
    expect(usePrototypeViewStore.getState().states).toEqual({})
  })

  it('sets the filter and the selected request as given', () => {
    const store = usePrototypeViewStore.getState()
    store.setFilter('codex')
    store.selectRequest('r2')
    expect(usePrototypeViewStore.getState()).toMatchObject({
      filter: 'codex',
      selectedRequestId: 'r2'
    })
  })
})
