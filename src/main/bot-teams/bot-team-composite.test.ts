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

  it('is empty when no other bot is needed, or the ids are not on the team', () => {
    expect(botTeamCompositeNotes(BOTS, [])).toBeNull()
    expect(botTeamCompositeNotes(BOTS, ['ghost'])).toBeNull()
  })
})
