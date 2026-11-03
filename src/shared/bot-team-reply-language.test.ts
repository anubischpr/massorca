import { describe, expect, it } from 'vitest'
import {
  botTeamReplyLanguage,
  detectBotTeamReplyLanguage,
  pickBotTeamLine
} from './bot-team-reply-language'

describe('detectBotTeamReplyLanguage', () => {
  it('reads a Spanish message as Spanish', () => {
    expect(detectBotTeamReplyLanguage('En qué nos quedamos en NexusCare?')).toBe('es')
    expect(detectBotTeamReplyLanguage('Saben qué es Jev AI?')).toBe('es')
    expect(detectBotTeamReplyLanguage('Hola')).toBe('es')
  })

  it('reads an English message as English', () => {
    expect(detectBotTeamReplyLanguage('What did we finish on NexusCare?')).toBe('en')
    expect(detectBotTeamReplyLanguage('Can you check this?')).toBe('en')
    expect(detectBotTeamReplyLanguage('hi')).toBe('en')
  })

  it('has no answer for a message with no clear language', () => {
    expect(detectBotTeamReplyLanguage('NexusCare?')).toBeNull()
    expect(detectBotTeamReplyLanguage('')).toBeNull()
  })
})

describe('botTeamReplyLanguage', () => {
  it('follows the language of the message over the app language', () => {
    expect(botTeamReplyLanguage({ text: 'What did we finish?', uiLanguage: 'es' })).toBe('en')
    expect(botTeamReplyLanguage({ text: 'En qué quedamos?', uiLanguage: 'en' })).toBe('es')
  })

  it('falls back to the app language for an unclear message, and to English when that has no lines', () => {
    expect(botTeamReplyLanguage({ text: 'NexusCare?', uiLanguage: 'es' })).toBe('es')
    expect(botTeamReplyLanguage({ text: 'NexusCare?', uiLanguage: 'fr' })).toBe('en')
    expect(botTeamReplyLanguage({ text: 'NexusCare?', uiLanguage: 'system' })).toBe('en')
    expect(botTeamReplyLanguage({ text: null })).toBe('en')
  })
})

describe('pickBotTeamLine', () => {
  const lines = { en: 'On it.', es: 'En ello.' }

  it('picks the line of the language', () => {
    expect(pickBotTeamLine(lines, 'es')).toBe('En ello.')
    expect(pickBotTeamLine(lines, 'en')).toBe('On it.')
  })

  it('uses English for a language that has no line yet', () => {
    expect(pickBotTeamLine({ en: 'On it.' }, 'es')).toBe('On it.')
  })
})
