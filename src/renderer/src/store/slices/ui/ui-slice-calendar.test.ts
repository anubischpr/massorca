import { describe, expect, it } from 'vitest'
import { isLeftSidebarView } from '../../../app-shell/left-sidebar-views'
import { canShowRightSidebarForView } from '../../../lib/right-sidebar-visibility'
import { isTopLevelView } from '../../../../../shared/top-level-view'
import { createTestStore, seedStore } from '../store-test-helpers'

describe('the Calendar page', () => {
  it('opens on its own top-level view, beside the rail with no sidebars', () => {
    const store = createTestStore()
    seedStore(store, { activeView: 'tasks' })
    store.getState().openCalendarPage()
    expect(store.getState().activeView).toBe('calendar')
    expect(isLeftSidebarView('calendar')).toBe(false)
    expect(canShowRightSidebarForView('calendar')).toBe(false)
  })

  it('survives a relaunch as a saved view', () => {
    expect(isTopLevelView('calendar')).toBe(true)
  })
})
