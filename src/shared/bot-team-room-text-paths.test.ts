import { describe, expect, it } from 'vitest'
import { botTeamRoomTextWithFileNames } from './bot-team-room-text-paths'

describe('botTeamRoomTextWithFileNames', () => {
  it('cuts an absolute POSIX path to its file name, keeping the sentence', () => {
    expect(
      botTeamRoomTextWithFileNames(
        'Guardé el informe con mejoras P1/P2/P3 priorizadas en /home/christian/orca/workspaces/NexusCare/en-nexuscare-4a39dc/docs/exploration-2026-11-05/documentation-health.md.'
      )
    ).toBe('Guardé el informe con mejoras P1/P2/P3 priorizadas en documentation-health.md.')
  })

  it('cuts relative and Windows paths too', () => {
    expect(
      botTeamRoomTextWithFileNames(
        'Entregables: docs/exploration-2026-11-05/frontend-impacto.html y C:\\work\\docs\\plan.md'
      )
    ).toBe('Entregables: frontend-impacto.html y plan.md')
  })

  it('leaves URLs, bare file names, ratios and versions alone', () => {
    const text =
      'Ver https://example.com/docs/a.html, el archivo plan.md, 1/2.5 del total y la v1.2.3'
    expect(botTeamRoomTextWithFileNames(text)).toBe(text)
  })
})
