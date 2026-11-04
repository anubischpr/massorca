import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLeftSidebarView } from '../../../app-shell/left-sidebar-views'
import { canShowRightSidebarForView } from '../../../lib/right-sidebar-visibility'
import { isTopLevelView } from '../../../../../shared/top-level-view'
import { createTestStore, seedStore } from '../store-test-helpers'
import { makePersistedUI } from '../ui-slice-test-harness'

describe('the Calendar page', () => {
  it('opens on its own top-level view, beside the rail with no sidebars', () => {
    const store = createTestStore()
    seedStore(store, { activeView: 'tasks' })
    store.getState().openCalendarPage()
    expect(store.getState().activeView).toBe('calendar')
    expect(isLeftSidebarView('calendar')).toBe(false)
    expect(canShowRightSidebarForView('calendar', store.getState().botTeamsSelection)).toBe(false)
  })

  it('survives a relaunch as a saved view', () => {
    expect(isTopLevelView('calendar')).toBe(true)
  })
})

describe('the Calendar done-run filter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves each change, and a relaunch restores the saved choice', () => {
    const setUI = vi.fn(() => Promise.resolve())
    vi.stubGlobal('window', { api: { ui: { set: setUI } } })
    const store = createTestStore()
    expect(store.getState().calendarShowDoneRuns).toBe(false)
    store.getState().setCalendarShowDoneRuns(true)
    expect(store.getState().calendarShowDoneRuns).toBe(true)
    expect(setUI).toHaveBeenCalledWith({ calendarShowDoneRuns: true })

    const relaunched = createTestStore()
    relaunched
      .getState()
      .hydratePersistedUI(makePersistedUI({ calendarShowDoneRuns: true }), 'startup')
    expect(relaunched.getState().calendarShowDoneRuns).toBe(true)
  })

  it('reads a saved file with no choice as hidden', () => {
    const store = createTestStore()
    store.getState().hydratePersistedUI(makePersistedUI(), 'startup')
    expect(store.getState().calendarShowDoneRuns).toBe(false)
  })
})
