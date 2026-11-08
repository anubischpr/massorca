import { describe, expect, it } from 'vitest'
import { botTeamSentRequestMessageId, placeBotTeamRoomTasks } from './bot-team-room-order'

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

  it('keeps a routine run at the time it ran, after any message, not at the end (pv84 QA)', () => {
    const run = { ...card('t', 'Daily hello', 250), fromRoutine: true }
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 100), bot('r', 'Done', 200), bot('s', 'Later news', 300)],
      [run]
    )

    expect(placed.cardsByMessageId.get('r')).toEqual([run])
    expect(placed.trailing).toEqual([])
  })

  it('puts a routine run made before every message before the conversation', () => {
    const run = { ...card('t', 'Daily hello', 50), fromRoutine: true }
    const placed = placeBotTeamRoomTasks([person('a', 'Make the report', 100)], [run])

    expect(placed.leading).toEqual([run])
    expect(placed.trailing).toEqual([])
  })

  it('keeps a routine run whose prompt someone also typed at its own time', () => {
    const run = { ...card('t', 'Daily hello', 250), fromRoutine: true }
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Daily hello', 100), bot('r', 'Hi', 200)],
      [run]
    )

    expect(placed.cardsByMessageId.get('r')).toEqual([run])
  })

  it('keeps several cards under one request in the order they were made', () => {
    const placed = placeBotTeamRoomTasks(
      [person('a', 'Make the report', 100)],
      [card('t1', 'Make the report', 110), card('t2', 'Make the report', 120)]
    )

    expect(placed.cardsByMessageId.get('a')?.map((task) => task.id)).toEqual(['t1', 't2'])
  })
})

describe('botTeamSentRequestMessageId', () => {
  const room = [
    person('a', 'Ask Design for a logo', 100),
    bot('r', 'Sent', 150),
    person('b', 'Thanks', 300)
  ]

  it('keeps a request under the message it names', () => {
    expect(
      botTeamSentRequestMessageId(room, { messageId: 'a', task: card('t', 'other', 400) })
    ).toBe('a')
  })

  it('places a request that names no message under the person line it came from, not at the end', () => {
    expect(
      botTeamSentRequestMessageId(room, {
        messageId: null,
        task: card('t', 'Ask Design for a logo', 400)
      })
    ).toBe('a')
    expect(
      botTeamSentRequestMessageId(room, { messageId: 'gone', task: card('t', 'A logo', 200) })
    ).toBe('a')
  })

  it('leaves a request with neither a message nor a time after the conversation', () => {
    expect(
      botTeamSentRequestMessageId(room, { messageId: null, task: card('t', 'A logo') })
    ).toBeNull()
  })
})
