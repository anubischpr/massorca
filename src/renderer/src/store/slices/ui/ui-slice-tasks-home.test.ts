import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, seedStore } from '../store-test-helpers'

describe('Tasks home versus the source-control task board', () => {
  const store = createTestStore()

  beforeEach(() => {
    seedStore(store, { activeView: 'terminal', tasksHomeOpen: false })
  })

  it('opens the Tasks home on the tasks view', () => {
    store.getState().openTasksHome()
    expect(store.getState().activeView).toBe('tasks')
    expect(store.getState().tasksHomeOpen).toBe(true)
  })

  it('leaves the board reachable: every openTaskPage entry point shows the board, not the home', () => {
    store.getState().openTasksHome()
    store.getState().openTaskPage({ taskSource: 'github' })
    expect(store.getState().activeView).toBe('tasks')
    expect(store.getState().tasksHomeOpen).toBe(false)
  })

  it('starts on the board when nothing opened the home', () => {
    store.getState().openTaskPage()
    expect(store.getState().tasksHomeOpen).toBe(false)
  })
})
