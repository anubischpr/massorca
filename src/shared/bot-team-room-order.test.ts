import { describe, expect, it } from 'vitest'
import { placeBotTeamRoomTasks } from './bot-team-room-order'

const person = (id: string, text: string, createdAt?: number | null) => ({
  id,
  authorBotId: null,
  text,
  createdAt
})
const bot = (id: string, text: string, createdAt?: number | null) => ({
  id,
  authorBotId: 'iris',
  text,
  createdAt
})
const card = (id: string, prompt: string, createdAt?: number | null) => ({
  id,
  prompt,
  createdAt
})

describe('placeBotTeamRoomTasks', () => {
  it('keeps a card under the request with the same prompt', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the flyer', 100), person('b', 'Thanks', 300)],
      [card('t', 'Make the flyer', 200)]
    )

    expect(placed.cardsByMessageId.get('a')).toEqual([card('t', 'Make the flyer', 200)])
    expect(placed.trailing).toEqual([])
  })

  it('puts a card made from a request with other words after that request, before a later message', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 100), person('b', 'Thanks, that is all', 300)],
      [card('t', 'Build the slides', 200)]
    )

    expect(placed.cardsByMessageId.get('a')).toEqual([card('t', 'Build the slides', 200)])
    expect(placed.cardsByMessageId.has('b')).toBe(false)
    expect(placed.trailing).toEqual([])
  })

  it('takes the latest request made at or before the card when the prompts differ', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'First', 100), person('c', 'Second', 150), person('b', 'Third', 300)],
      [card('t', 'Something else', 200)]
    )

    expect(placed.cardsByMessageId.get('c')).toEqual([card('t', 'Something else', 200)])
  })

  it('never anchors a card to a bot message', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 100), bot('r', 'On it', 150)],
      [card('t', 'Something else', 200)]
    )

    expect(placed.cardsByMessageId.get('a')).toEqual([card('t', 'Something else', 200)])
    expect(placed.cardsByMessageId.has('r')).toBe(false)
  })

  it('puts a card made before every request after the conversation', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 300)],
      [card('t', 'Something else', 200)]
    )

    expect(placed.trailing).toEqual([card('t', 'Something else', 200)])
  })

  it('keeps today’s placement for a host that sends no times', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report')],
      [card('t', 'Something else'), card('u', 'Make the report')]
    )

    expect(placed.cardsByMessageId.get('a')).toEqual([card('u', 'Make the report')])
    expect(placed.trailing).toEqual([card('t', 'Something else')])
  })

  it('keeps several cards under one request in the order they were made', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 100)],
      [card('t1', 'Make the report', 110), card('t2', 'Make the report', 120)]
    )

    expect(placed.cardsByMessageId.get('a')?.map((task) => task.id)).toEqual(['t1', 't2'])
  })
})
