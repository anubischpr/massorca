import { describe, expect, it } from 'vitest'
import {
  encodeBotTeamRoomSourceTask,
  splitBotTeamRoomSourceTask
} from './bot-team-room-source-task-marker'

describe('the task a room line carries', () => {
  it('reads back the task that posted the line, with the visible text unchanged', () => {
    const stored = encodeBotTeamRoomSourceTask('Listo', 'bottask_abc123')

    expect(splitBotTeamRoomSourceTask(stored)).toEqual({
      text: 'Listo',
      sourceTaskId: 'bottask_abc123'
    })
  })

  it('stores nothing for a line no task posted', () => {
    expect(encodeBotTeamRoomSourceTask('Listo', undefined)).toBe('Listo')
    expect(splitBotTeamRoomSourceTask('Listo')).toEqual({ text: 'Listo', sourceTaskId: null })
  })

  it('keeps the text as written when the task id is malformed', () => {
    expect(encodeBotTeamRoomSourceTask('Listo', 'bad id')).toBe('Listo')
  })
})
