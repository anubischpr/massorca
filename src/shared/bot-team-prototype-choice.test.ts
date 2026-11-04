import { describe, expect, it } from 'vitest'
import {
  botTeamPrototypeChoiceIn,
  withBotTeamPrototypeChoice,
  withoutBotTeamPrototypeChoice
} from './bot-team-prototype-choice'

describe('a prototype choice kept in a task start notes', () => {
  it('reads back the count and the design system mode', () => {
    const notes = withBotTeamPrototypeChoice('Clock paragraph.', {
      count: 3,
      designSystem: 'propose'
    })
    expect(botTeamPrototypeChoiceIn(notes)).toEqual({ count: 3, designSystem: 'propose' })
  })

  it('reads a choice without a design system mode', () => {
    expect(botTeamPrototypeChoiceIn(withBotTeamPrototypeChoice(null, { count: 2 }))).toEqual({
      count: 2
    })
  })

  it('finds none in notes without one', () => {
    expect(botTeamPrototypeChoiceIn('Clock paragraph.')).toBeNull()
    expect(botTeamPrototypeChoiceIn(null)).toBeNull()
  })

  it('takes the choice out and leaves the other notes', () => {
    const notes = withBotTeamPrototypeChoice('A.\n\nB.', { count: 1 })
    expect(withoutBotTeamPrototypeChoice(notes)).toBe('A.\n\nB.')
    expect(withoutBotTeamPrototypeChoice(withBotTeamPrototypeChoice(null, { count: 1 }))).toBeNull()
  })

  it('keeps a single choice when one is added twice', () => {
    const once = withBotTeamPrototypeChoice(null, { count: 1 })
    expect(botTeamPrototypeChoiceIn(withBotTeamPrototypeChoice(once, { count: 3 }))).toEqual({
      count: 3
    })
  })
})
