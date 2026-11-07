import { describe, expect, it } from 'vitest'
import {
  botTeamFilesQuestion,
  botTeamFilesQuestionLines,
  isBotTeamFilesWithoutWords
} from './bot-team-files-only-question'

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }
const LOGO = { path: 'attachments/logo.png', name: 'logo.png' }

describe('botTeamFilesQuestion', () => {
  it('asks what to do with the files, in the language the person wrote before', () => {
    expect(
      botTeamFilesQuestion([FLYER], 'Hazme el flyer para la semana que viene, por favor')
    ).toBe('¿Qué quieres que haga con flyer.png?')
    expect(botTeamFilesQuestion([FLYER, LOGO], 'Make the flyer, please')).toBe(
      'What do you want me to do with flyer.png, logo.png?'
    )
  })

  it('lists the question in each language, so a walk over the room can find it again', () => {
    expect(botTeamFilesQuestionLines([FLYER])).toEqual([
      'What do you want me to do with flyer.png?',
      '¿Qué quieres que haga con flyer.png?'
    ])
  })
})

describe('isBotTeamFilesWithoutWords', () => {
  it('is true for files alone, or for files with only the @name they are sent to', () => {
    expect(isBotTeamFilesWithoutWords('', [FLYER])).toBe(true)
    expect(isBotTeamFilesWithoutWords('Files attached: flyer.png', [FLYER])).toBe(true)
    expect(isBotTeamFilesWithoutWords('@Iris', [FLYER])).toBe(true)
    expect(isBotTeamFilesWithoutWords('@Iris @Max', [FLYER])).toBe(true)
  })

  it('is false when the words say what to do, or when there are no files', () => {
    expect(isBotTeamFilesWithoutWords('@Iris haz el flyer', [FLYER])).toBe(false)
    expect(isBotTeamFilesWithoutWords('Haz el flyer', [FLYER])).toBe(false)
    expect(isBotTeamFilesWithoutWords('', [])).toBe(false)
    expect(isBotTeamFilesWithoutWords('@Iris', [])).toBe(false)
  })
})
