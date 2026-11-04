import { describe, expect, it, vi } from 'vitest'
import {
  hasLeftSidebarToggle,
  isLeftSidebarView,
  toggleLeftSidebarWhereShown
} from './left-sidebar-views'

describe('where the left sidebar exists', () => {
  it('is on the home views, the ones the Workspaces / Bot Teams rail button opens, and on Prototypes', () => {
    for (const view of ['terminal', 'create-chat', 'bot-teams', 'prototypes'] as const) {
      expect(isLeftSidebarView(view), view).toBe(true)
    }
  })

  it('is on no other page: Tasks, Settings, Artifacts, Skills, Automations, Mobile', () => {
    for (const view of [
      'tasks',
      'settings',
      'artifacts',
      'skills',
      'automations',
      'mobile',
      'activity',
      'space'
    ] as const) {
      expect(isLeftSidebarView(view), view).toBe(false)
    }
  })
})

describe('where the sidebar toggle shows', () => {
  it('is on the home views and on Prototypes, whose list is its left sidebar', () => {
    for (const view of ['terminal', 'create-chat', 'bot-teams', 'prototypes'] as const) {
      expect(hasLeftSidebarToggle(view), view).toBe(true)
    }
  })

  it('is on no page without a left column', () => {
    for (const view of ['tasks', 'settings', 'artifacts', 'skills', 'mobile'] as const) {
      expect(hasLeftSidebarToggle(view), view).toBe(false)
    }
  })
})

describe('the sidebar shortcut and menu item', () => {
  it('toggle the Prototypes list too', () => {
    const toggleSidebar = vi.fn()
    expect(toggleLeftSidebarWhereShown({ activeView: 'prototypes', toggleSidebar })).toBe(true)
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('toggle the sidebar on a home view', () => {
    const toggleSidebar = vi.fn()
    expect(toggleLeftSidebarWhereShown({ activeView: 'terminal', toggleSidebar })).toBe(true)
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('do nothing elsewhere, so the sidebar is not left toggled out of sight when returning home', () => {
    const toggleSidebar = vi.fn()
    expect(toggleLeftSidebarWhereShown({ activeView: 'tasks', toggleSidebar })).toBe(false)
    expect(toggleSidebar).not.toHaveBeenCalled()
  })
})
