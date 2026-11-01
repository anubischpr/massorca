import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, seedStore } from '../store-test-helpers'

describe('the rail mode button', () => {
  const store = createTestStore()

  beforeEach(() => {
    seedStore(store, {
      activeView: 'terminal',
      railMode: 'workspaces',
      railWorkspacesHintShown: false
    })
  })

  it('switches Workspaces to Bot teams from the workspaces home, and back', () => {
    expect(store.getState().pressRailModeButton()).toBe('switched')
    expect(store.getState().railMode).toBe('bot-teams')
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().pressRailModeButton()).toBe('switched')
    expect(store.getState().railMode).toBe('workspaces')
    expect(store.getState().activeView).toBe('terminal')
  })

  it('treats the create page as the workspaces home, as the canvas does', () => {
    seedStore(store, { activeView: 'create-chat' })
    store.getState().pressRailModeButton()
    expect(store.getState().railMode).toBe('bot-teams')
  })

  it('returns to the current mode home from another page without switching', () => {
    seedStore(store, { activeView: 'settings', railMode: 'workspaces' })
    expect(store.getState().pressRailModeButton()).toBe('returned')
    expect(store.getState().railMode).toBe('workspaces')
    expect(store.getState().activeView).toBe('terminal')
  })

  it('keeps Bot teams as the mode through Tasks and Settings, and returns to its home', () => {
    store.getState().pressRailModeButton()
    expect(store.getState().railMode).toBe('bot-teams')
    store.getState().openTasksHome()
    expect(store.getState().activeView).toBe('tasks')
    expect(store.getState().railMode).toBe('bot-teams')
    expect(store.getState().pressRailModeButton()).toBe('returned')
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().railMode).toBe('bot-teams')
    store.getState().openSettingsPage()
    expect(store.getState().railMode).toBe('bot-teams')
    store.getState().pressRailModeButton()
    expect(store.getState().activeView).toBe('bot-teams')
  })
})
