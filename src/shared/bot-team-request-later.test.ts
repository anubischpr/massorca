import { describe, expect, it } from 'vitest'
import { botTeamRequestTiming } from './bot-team-request-later'

describe('botTeamRequestTiming', () => {
  it('reads the QA message as a later request for tomorrow, filed to Todo', () => {
    expect(
      botTeamRequestTiming(
        'tengo como pendiente la tarea de analizar mejoras de front, pero no para hoy, sino para mañana, agréguenlo al Todo.'
      )
    ).toEqual({ later: true, when: 'tomorrow' })
  })

  it('reads adding a request to Todo, in Spanish or English, as later without a day', () => {
    expect(botTeamRequestTiming('Agrégalo al Todo')).toEqual({ later: true, when: null })
    expect(botTeamRequestTiming('Save this to Todo')).toEqual({ later: true, when: null })
  })

  it('reads más tarde, later and English tomorrow', () => {
    expect(botTeamRequestTiming('Hazlo más tarde')).toEqual({ later: true, when: 'later' })
    expect(botTeamRequestTiming('Do it later')).toEqual({ later: true, when: 'later' })
    expect(botTeamRequestTiming('Write the report for tomorrow')).toEqual({
      later: true,
      when: 'tomorrow'
    })
  })

  it('does not read this morning, or a plain request, as later', () => {
    expect(botTeamRequestTiming('Revisa esta mañana el stock')).toEqual({
      later: false,
      when: null
    })
    expect(botTeamRequestTiming('Count the boxes')).toEqual({ later: false, when: null })
    expect(botTeamRequestTiming('Pon la lista en todo el sitio')).toEqual({
      later: false,
      when: null
    })
    expect(botTeamRequestTiming('Dile al todo el equipo que revise el stock')).toEqual({
      later: false,
      when: null
    })
  })
})
