import { describe, expect, it } from 'vitest'
import { botTeamFiledReply } from './bot-team-filed-reply'

const FILED = { started: false, later: false, when: null, projectName: null, startError: null }

describe('botTeamFiledReply', () => {
  it('says the bot is on it when the request starts', () => {
    expect(botTeamFiledReply({ ...FILED, started: true })).toBe('On it.')
  })

  it('names the project a started request works in', () => {
    expect(botTeamFiledReply({ ...FILED, started: true, projectName: 'NexusCare' })).toBe(
      'On it, in NexusCare.'
    )
  })

  it('says a later request is in Todo for its day, in its project', () => {
    expect(
      botTeamFiledReply({ ...FILED, later: true, when: 'tomorrow', projectName: 'NexusCare' })
    ).toBe('Added to Todo for tomorrow in NexusCare.')
  })

  it('says a request saved to Todo without a day is in Todo', () => {
    expect(botTeamFiledReply({ ...FILED, later: true })).toBe('Added to Todo.')
    expect(botTeamFiledReply({ ...FILED, later: true, when: 'later' })).toBe(
      'Added to Todo for later.'
    )
  })

  it('says why a started request is waiting in Todo instead', () => {
    expect(botTeamFiledReply({ ...FILED, started: true, startError: 'The bot is busy.' })).toBe(
      'Added to Todo. It did not start: The bot is busy.'
    )
  })
})
