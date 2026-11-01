import { describe, expect, it } from 'vitest'
import { TASKS_HOME_CREATE_MODES, defaultTasksHomeCreateMode } from './tasks-home-create-modes'

describe('Tasks home create modes', () => {
  it('lists WorkSpaces first and Bot Team second', () => {
    expect(TASKS_HOME_CREATE_MODES).toEqual(['workspaces', 'bot-team'])
  })

  it('opens on WorkSpaces, and on Bot Team when the rail is in Bot teams mode', () => {
    expect(defaultTasksHomeCreateMode('workspaces')).toBe('workspaces')
    expect(defaultTasksHomeCreateMode('bot-teams')).toBe('bot-team')
  })
})
