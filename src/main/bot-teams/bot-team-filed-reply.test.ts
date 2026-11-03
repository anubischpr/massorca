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

  it('answers an English request in English, with the same templates', () => {
    const text = 'Can you check NexusCare tomorrow?'
    expect(botTeamFiledReply({ ...FILED, started: true, projectName: 'NexusCare', text })).toBe(
      'On it, in NexusCare.'
    )
    expect(
      botTeamFiledReply({ ...FILED, later: true, when: 'tomorrow', projectName: 'NexusCare', text })
    ).toBe('Added to Todo for tomorrow in NexusCare.')
    expect(botTeamFiledReply({ ...FILED, started: true, startError: 'Bot busy', text })).toBe(
      'Added to Todo. It did not start: Bot busy'
    )
  })

  it('answers a Spanish request in Spanish, with the same templates', () => {
    const text = 'Revisa NexusCare mañana, por favor'
    expect(botTeamFiledReply({ ...FILED, started: true, text })).toBe('En ello.')
    expect(botTeamFiledReply({ ...FILED, started: true, projectName: 'NexusCare', text })).toBe(
      'En ello, en NexusCare.'
    )
    expect(
      botTeamFiledReply({ ...FILED, later: true, when: 'tomorrow', projectName: 'NexusCare', text })
    ).toBe('Añadido a Todo para mañana en NexusCare.')
    expect(botTeamFiledReply({ ...FILED, later: true, when: 'later', text })).toBe(
      'Añadido a Todo para más tarde.'
    )
    expect(botTeamFiledReply({ ...FILED, later: true, text })).toBe('Añadido a Todo.')
    expect(botTeamFiledReply({ ...FILED, started: true, startError: 'Bot busy', text })).toBe(
      'Añadido a Todo. No se inició: Bot busy'
    )
  })

  it('uses the app language when the request is unclear, and English without either', () => {
    expect(
      botTeamFiledReply({ ...FILED, started: true, text: 'NexusCare?', uiLanguage: 'es' })
    ).toBe('En ello.')
    expect(botTeamFiledReply({ ...FILED, started: true, text: 'NexusCare?' })).toBe('On it.')
  })
})
