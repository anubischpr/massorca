import { describe, expect, it } from 'vitest'
import { botTeamTypingAuthor } from './bot-team-typing'

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
