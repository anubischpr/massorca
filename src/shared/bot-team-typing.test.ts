import { describe, expect, it } from 'vitest'
import {
  botTeamReplyingAuthor,
  botTeamTypingAuthor,
  newBotTeamClientRequestId
} from './bot-team-typing'

const BOTS = [
  { id: 'b1', name: 'Iris' },
  { id: 'b2', name: 'Max' }
]

describe('who the room shows as typing', () => {
  it('shows All for a greeting', () => {
    expect(botTeamTypingAuthor('Hola!', BOTS)).toEqual({ kind: 'all' })
  })

  it('shows the bot the message mentions', () => {
    expect(botTeamTypingAuthor('@Max can you check stock?', BOTS)).toEqual({
      kind: 'bot',
      bot: BOTS[1]
    })
  })

  it('shows no name before the host picks a bot', () => {
    expect(botTeamTypingAuthor('Where did we leave NexusCare?', BOTS)).toEqual({ kind: 'team' })
  })
})

describe('who the room shows as typing while the host reports a reply in flight', () => {
  it('shows the bot the host names', () => {
    expect(botTeamReplyingAuthor([{ botId: 'b2', since: 1 }], BOTS)).toEqual({
      kind: 'bot',
      bot: BOTS[1]
    })
  })

  it('shows the neutral line for a bot this client does not know, and nothing when none replies', () => {
    expect(botTeamReplyingAuthor([{ botId: 'gone', since: 1 }], BOTS)).toEqual({ kind: 'team' })
    expect(botTeamReplyingAuthor([], BOTS)).toBeNull()
    expect(botTeamReplyingAuthor(undefined, BOTS)).toBeNull()
  })
})

describe('the id of one send', () => {
  it('differs between sends and stays within the host limit', () => {
    const first = newBotTeamClientRequestId()
    expect(first).not.toBe(newBotTeamClientRequestId())
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThanOrEqual(100)
  })
})
