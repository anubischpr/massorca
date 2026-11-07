import { describe, expect, it } from 'vitest'
import { botTeamCompositeNotes } from './bot-team-composite'

const BOTS = [
  { id: 'iris', name: 'Iris', job: 'Designs flyers' },
  { id: 'max', name: 'Max', job: 'Writes copy' },
  { id: 'bea', name: 'Bea', job: '' }
]

describe('botTeamCompositeNotes', () => {
  it('tells the owner to do its part and coordinate the rest through team-delegate', () => {
    const notes = botTeamCompositeNotes(BOTS, ['max', 'bea'])
    expect(notes).toContain('composite')
    expect(notes).toContain('Max (Writes copy)')
    expect(notes).toContain('Bea')
    expect(notes).not.toContain('Iris')
    expect(notes).toContain('orca orchestration team-delegate --bot <name> --text')
  })

  it('keeps the hand-offs out of the room and has the owner react to a failed one', () => {
    const notes = botTeamCompositeNotes(BOTS, ['max']) ?? ''
    expect(notes).toContain('Yo tomaré')
    expect(notes).toContain('Never mention the hand-offs')
    expect(notes).toContain('If that command fails, the part did not start')
  })

  it("has the owner post only its own deliverable, never a teammate's files", () => {
    const notes = botTeamCompositeNotes(BOTS, ['max']) ?? ''
    expect(notes).toContain('post your own deliverable once, by file name, never a path')
    expect(notes).toContain('never re-list or re-attach files a teammate made')
  })

  it('is empty when no other bot is needed, or the ids are not on the team', () => {
    expect(botTeamCompositeNotes(BOTS, [])).toBeNull()
    expect(botTeamCompositeNotes(BOTS, ['ghost'])).toBeNull()
  })

  it('has the owner run waits and independent parts at the same time, and report each outcome', () => {
    const notes = botTeamCompositeNotes(BOTS, ['max']) ?? ''
    expect(notes).toContain('Run waits and other independent parts at the same time, not blocking')
    expect(notes).toContain('list the outcome of each part, including any background wait')
  })

  it('applies the failed hand-off rule to orchestration delegate too', () => {
    const notes = botTeamCompositeNotes(BOTS, ['max']) ?? ''
    expect(notes).toContain(
      '`orca orchestration delegate` when it files a child session for a part: if it fails, the part did not start'
    )
  })
})
