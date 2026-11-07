import { describe, expect, it } from 'vitest'
import { placeBotTeamRoomTasks } from './bot-team-room-order'

describe('a task that answers a message', () => {
  it('gets no card in the room, and the deliverable card under the same request stays', () => {
    const placed = placeBotTeamRoomTasks(
      [{ id: 'a', authorBotId: null, text: 'Make the flyer', createdAt: 100 }],
      [
        { id: 'reply', prompt: 'Make the flyer', createdAt: 200, answersMessageId: 'a' },
        { id: 'deliverable', prompt: 'Make the flyer', createdAt: 210 }
      ]
    )

    expect(placed.cardsByMessageId.get('a')).toEqual([
      { id: 'deliverable', prompt: 'Make the flyer', createdAt: 210 }
    ])
    expect(placed.trailing).toEqual([])
    expect(placed.leading).toEqual([])
  })
})
