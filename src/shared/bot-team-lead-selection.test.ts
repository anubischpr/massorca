import { describe, expect, it } from 'vitest'
import { chooseBotTeamLead, findMentionedBot } from './bot-team-lead-selection'

const IRIS = { id: 'iris', name: 'Iris' }
const MAX = { id: 'max', name: 'Max' }
const BOTS = [IRIS, MAX]

describe('findMentionedBot', () => {
  it('finds a bot named with @, in any case', () => {
    expect(findMentionedBot('@iris please draft it', BOTS)).toBe(IRIS)
  })

  it('does not treat the bare name or a longer word as a mention', () => {
    expect(findMentionedBot('ask Iris about it', BOTS)).toBeNull()
    expect(findMentionedBot('@irisa please', BOTS)).toBeNull()
  })

  it('matches a bot whose name has a space', () => {
    const nora = { id: 'nora', name: 'Nora Lee' }
    expect(findMentionedBot('hi @Nora Lee', [nora])).toBe(nora)
  })
})

describe('chooseBotTeamLead', () => {
  it('leaves the lead open when no bot matches, so the room asks', () => {
    expect(chooseBotTeamLead({ matchedBotIds: [], bots: BOTS, activeTasksByBot: {} })).toBeNull()
  })

  it('takes the only match even when it is busier', () => {
    expect(
      chooseBotTeamLead({ matchedBotIds: ['max'], bots: BOTS, activeTasksByBot: { max: 5 } })
    ).toBe(MAX)
  })

  it('breaks a collision by the fewest active tasks', () => {
    expect(
      chooseBotTeamLead({
        matchedBotIds: ['iris', 'max'],
        bots: BOTS,
        activeTasksByBot: { iris: 2, max: 1 }
      })
    ).toBe(MAX)
  })

  it('breaks an equal load by team order, so the choice is stable', () => {
    expect(
      chooseBotTeamLead({ matchedBotIds: ['max', 'iris'], bots: BOTS, activeTasksByBot: {} })
    ).toBe(IRIS)
  })

  it('ignores an id that is not on the team', () => {
    expect(chooseBotTeamLead({ matchedBotIds: ['ghost'], bots: BOTS, activeTasksByBot: {} })).toBe(
      null
    )
  })
})
