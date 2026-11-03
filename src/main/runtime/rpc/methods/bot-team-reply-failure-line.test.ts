import { describe, expect, it } from 'vitest'
import { botTeamReplyFailureLine } from './bot-team-reply-failure-line'

describe('botTeamReplyFailureLine', () => {
  it('says no one could answer and to mention a bot, in the language of the question', () => {
    expect(botTeamReplyFailureLine('Can you check this?')).toBe(
      'No one could answer that just now. Mention a bot with @ to ask again.'
    )
    expect(botTeamReplyFailureLine('Cómo va el texto?')).toBe(
      'Nadie pudo responder eso ahora. Menciona a un bot con @ para volver a preguntar.'
    )
  })
})
