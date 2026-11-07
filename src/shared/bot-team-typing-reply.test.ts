import { describe, expect, it } from 'vitest'
import { botTeamAnsweringReplying } from './bot-team-typing'

type RoomTask = Parameters<typeof botTeamAnsweringReplying>[0][number]

const running: RoomTask = {
  ownerBotId: 'b1',
  sessionId: 's1',
  lastStatus: null,
  awaitingPerson: false,
  answersMessageId: 'm1',
  createdAt: 100
}

describe('the bots a reply task keeps typing for', () => {
  it('names the bot of a reply task that is still running', () => {
    expect(botTeamAnsweringReplying([running])).toEqual([{ botId: 'b1', since: 100 }])
  })

  it('names no bot once the reply task has ended, waits for the person, or has not started', () => {
    expect(botTeamAnsweringReplying([{ ...running, lastStatus: 'Done' }])).toEqual([])
    expect(botTeamAnsweringReplying([{ ...running, awaitingPerson: true }])).toEqual([])
    expect(botTeamAnsweringReplying([{ ...running, sessionId: null }])).toEqual([])
  })

  it('names no bot for a task that answers no message', () => {
    expect(botTeamAnsweringReplying([{ ...running, answersMessageId: undefined }])).toEqual([])
  })
})
