import { describe, expect, it } from 'vitest'
import { botTeamClockLine, botTeamClockNote, botTeamClockNoteIn } from './bot-team-person-clock'

// 04:38 UTC on Wednesday 4 Nov is still 23:38 on Tuesday 3 Nov in Lima.
const LIMA_NIGHT = Date.UTC(2026, 10, 4, 4, 38)

describe("the person's clock", () => {
  it("reads a moment on the person's zone, across the host's date boundary", () => {
    expect(botTeamClockLine(LIMA_NIGHT, 'America/Lima')).toBe(
      'Tuesday 2026-11-03 23:38 America/Lima'
    )
  })

  it("states the clock in a prompt sentence only when the person's zone is known", () => {
    expect(botTeamClockNote(LIMA_NIGHT, 'America/Lima')).toContain(
      'Tuesday 2026-11-03 23:38 America/Lima'
    )
    expect(botTeamClockNote(LIMA_NIGHT, 'Not/AZone')).toBeNull()
    expect(botTeamClockNote(LIMA_NIGHT, null)).toBeNull()
  })

  it("finds its own paragraph among a task's start notes", () => {
    const note = botTeamClockNote(LIMA_NIGHT, 'America/Lima')
    expect(botTeamClockNoteIn(`Composite plan.\n\n${note}\n\nFiles attached.`)).toBe(note)
    expect(botTeamClockNoteIn('Composite plan.')).toBeNull()
    expect(botTeamClockNoteIn(null)).toBeNull()
  })

  it("names the host's clock and zone when the person's zone is unknown", () => {
    expect(botTeamClockLine(LIMA_NIGHT)).toMatch(
      /^[A-Z][a-z]+ \d{4}-\d{2}-\d{2} \d{2}:\d{2}( \S+)?$/
    )
  })
})
