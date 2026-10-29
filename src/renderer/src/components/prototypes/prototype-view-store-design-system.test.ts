import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDesignSystemViewState } from '../../../../shared/prototype-design-system-view-state'
import { usePrototypeViewStore } from './prototype-view-store'

beforeEach(() => {
  usePrototypeViewStore.setState({
    filter: 'all',
    selectedRequestId: null,
    selectedProjectKey: null,
    states: {},
    designSystemViews: {}
  })
})

describe('usePrototypeViewStore selection', () => {
  it('selects a design system instead of a set, and a set instead of a design system', () => {
    usePrototypeViewStore.getState().selectRequest('r1')
    usePrototypeViewStore.getState().selectDesignSystem('nexus')
    expect(usePrototypeViewStore.getState()).toMatchObject({
      selectedProjectKey: 'nexus',
      selectedRequestId: null
    })
    usePrototypeViewStore.getState().selectRequest('r2')
    expect(usePrototypeViewStore.getState()).toMatchObject({
      selectedProjectKey: null,
      selectedRequestId: 'r2'
    })
  })
})

describe('usePrototypeViewStore design system views', () => {
  it('starts a project’s view from the empty state on its first update', () => {
    usePrototypeViewStore.getState().updateDesignSystemView('nexus', (state) => state)
    expect(usePrototypeViewStore.getState().designSystemViews.nexus).toEqual(
      emptyDesignSystemViewState()
    )
  })

  it('changes only the project an update names and keeps the others as they were', () => {
    const store = usePrototypeViewStore.getState()
    store.updateDesignSystemView('nexus', (state) => ({ ...state, tab: 'tokens' }))
    const nexus = usePrototypeViewStore.getState().designSystemViews.nexus
    store.updateDesignSystemView('landing', (state) => ({ ...state, freeText: 'warm' }))
    expect(usePrototypeViewStore.getState().designSystemViews.nexus).toBe(nexus)
    expect(usePrototypeViewStore.getState().designSystemViews).toMatchObject({
      nexus: { tab: 'tokens' },
      landing: { freeText: 'warm' }
    })
  })
})
