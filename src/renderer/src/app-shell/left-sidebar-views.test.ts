import { describe, expect, it, vi } from 'vitest'
import { isLeftSidebarView, toggleLeftSidebarWhereShown } from './left-sidebar-views'

describe('where the left sidebar exists', () => {
  it('is only on the home views, the ones the Workspaces / Bot Teams rail button opens', () => {
    for (const view of ['terminal', 'create-chat', 'bot-teams'] as const) {
      expect(isLeftSidebarView(view), view).toBe(true)
    }
  })

  it('is on no other page: Tasks, Settings, Prototypes, Artifacts, Skills, Automations, Mobile', () => {
    for (const view of [
      'tasks',
      'settings',
      'prototypes',
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

describe('the sidebar shortcut and menu item', () => {
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
