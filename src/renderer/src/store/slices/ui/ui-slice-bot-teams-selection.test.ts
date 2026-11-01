import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, seedStore } from '../store-test-helpers'

describe('the Bot teams selection', () => {
  const store = createTestStore()

  beforeEach(() => {
    seedStore(store, {
      activeView: 'terminal',
      railMode: 'workspaces',
      botTeamsSelection: { teamId: null, taskId: null, creating: false }
    })
  })

  it('starts on All teams with nothing open', () => {
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: null,
      taskId: null,
      creating: false
    })
  })

  it('opens a team on the Bot teams page and puts the rail in Bot teams mode', () => {
    store.getState().openBotTeamsView({ teamId: 'team-1' })
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().railMode).toBe('bot-teams')
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 'team-1',
      taskId: null,
      creating: false
    })
  })

  it('opens a task thread, and the new team form, replacing the old selection', () => {
    store.getState().openBotTeamsView({ teamId: 'team-1', taskId: 'task-9' })
    expect(store.getState().botTeamsSelection.taskId).toBe('task-9')
    store.getState().openBotTeamsView({ creating: true })
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: null,
      taskId: null,
      creating: true
    })
  })

  it('changes the selection in place without moving the page', () => {
    seedStore(store, { activeView: 'bot-teams', railMode: 'bot-teams' })
    store.getState().setBotTeamsSelection({ teamId: 'team-2', taskId: null, creating: false })
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().botTeamsSelection.teamId).toBe('team-2')
  })

  it('keeps the selection through Tasks, so the rail button returns to the open team', () => {
    store.getState().openBotTeamsView({ teamId: 'team-1' })
    store.getState().openTasksHome()
    expect(store.getState().botTeamsSelection.teamId).toBe('team-1')
    store.getState().pressRailModeButton()
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().botTeamsSelection.teamId).toBe('team-1')
  })
})
