import { describe, expect, it } from 'vitest'
import { botTeamReplyFailureLine } from './bot-team-reply-failure-line'

describe('botTeamReplyFailureLine', () => {
  it('says no one could answer, in English for an English question', () => {
    expect(botTeamReplyFailureLine('Can you check this?')).toBe(
      'No one could answer that just now. Mention a bot with @ to ask again.'
    )
  })

  it('says it in Spanish for a Spanish question', () => {
    expect(botTeamReplyFailureLine('Cómo va el texto?')).toBe(
      'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    )
    expect(botTeamReplyFailureLine('En qué nos quedamos en NexusCare?')).toBe(
      'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    )
  })

  it('falls back to the app language for an unclear question, and to English without one', () => {
    expect(botTeamReplyFailureLine('NexusCare?', 'es')).toBe(
      'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    )
    expect(botTeamReplyFailureLine('NexusCare?')).toBe(
      'No one could answer that just now. Mention a bot with @ to ask again.'
    )
  })
})
