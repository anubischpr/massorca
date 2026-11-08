import { describe, expect, it } from 'vitest'
import { botTeamQuestionOf } from './bot-team-task-question'

describe('the question a bot ends its turn with', () => {
  it('keeps only the question, without the next-step section a session adds', () => {
    const text = [
      'La imagen muestra el buscador de medicamentos de OPPM Web; no incluye una tabla de datos. ¿Qué resultado necesitas que produzca a partir de esta captura?',
      '',
      '**Siguiente Paso** — Tú: Indicar el objetivo del trabajo con el adjunto.'
    ].join('\n')

    expect(botTeamQuestionOf(text)).toBe(
      '¿Qué resultado necesitas que produzca a partir de esta captura?'
    )
  })

  it('reads an English question and drops the statements before it', () => {
    expect(botTeamQuestionOf('I looked at the screenshot. What should I do with the image?')).toBe(
      'What should I do with the image?'
    )
  })

  it('keeps the questions that close the reply together', () => {
    expect(botTeamQuestionOf('Done reading. Which tab? And for which team?')).toBe(
      'Which tab? And for which team?'
    )
  })

  it('finds nothing when the reply does not end on a question', () => {
    expect(botTeamQuestionOf('I made the flyer. Saved as flyer.png.')).toBeNull()
    expect(botTeamQuestionOf('Do you want it blue? I made it green anyway.')).toBeNull()
    expect(botTeamQuestionOf('')).toBeNull()
  })

  it('names a file by its name, never its path', () => {
    expect(botTeamQuestionOf('Should I use C:\\work\\team\\shot.png as the cover?')).toBe(
      'Should I use shot.png as the cover?'
    )
  })

  it('does not split a question at the dot of a file name', () => {
    expect(botTeamQuestionOf('Ready. Should I resize shot.png first?')).toBe(
      'Should I resize shot.png first?'
    )
  })

  it('ignores a question inside a code block and strips markdown marks', () => {
    const text = ['```', 'is this a question?', '```', '', '**¿Lo hago en azul?**'].join('\n')

    expect(botTeamQuestionOf(text)).toBe('¿Lo hago en azul?')
  })
})
