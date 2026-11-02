import { describe, expect, it } from 'vitest'
import { botTeamBoardColumn } from './bot-team-board-column'

describe('botTeamBoardColumn', () => {
  it.each([
    ['Not started', 'Todo'],
    ['Working', 'In Progress'],
    ['Stopped', 'In Progress'],
    ['Stuck', 'In Progress'],
    ['Waiting for you', 'In Review'],
    ['Done', 'Done']
  ] as const)('puts %s in %s', (status, column) => {
    expect(botTeamBoardColumn(status)).toBe(column)
  })
})
