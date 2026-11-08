import { describe, expect, it } from 'vitest'
import { isBotTeamSaveOnlyText } from './bot-team-files-save-only'

describe('a line that only asks to keep the files', () => {
  it.each([
    'Sólo guárdalo',
    'guárdalo',
    'guárdalos',
    'solo guarda el archivo',
    'Guárdalo, por favor',
    'guarda los archivos',
    'sólo guárdalos todos',
    'just save it',
    'keep it',
    'save them',
    'Just keep them, thanks',
    'save the file',
    '@Iris guárdalo'
  ])('reads "%s" as a save-only answer', (text) => {
    expect(isBotTeamSaveOnlyText(text)).toBe(true)
  })

  it.each([
    'guarda el archivo y crea una tarea',
    'Guárdalo como tarea para el viernes',
    'no lo guardes',
    'guarda un recordatorio para mañana',
    'save it to the Sales team',
    'keep the report for the team',
    'Resúmelo en tres puntos',
    'solo',
    '',
    '   '
  ])('does not read "%s" as a save-only answer', (text) => {
    expect(isBotTeamSaveOnlyText(text)).toBe(false)
  })
})
