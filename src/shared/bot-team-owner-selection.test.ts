import { describe, expect, it } from 'vitest'
import {
  chooseBotTeamOwner,
  findMentionedBot,
  findNamedProject,
  rankBotsForRequest
} from './bot-team-owner-selection'

const IRIS = { id: 'iris', name: 'Iris' }
const MAX = { id: 'max', name: 'Max' }
const BOTS = [IRIS, MAX]

describe('rankBotsForRequest', () => {
  const JUAN = { id: 'juan', name: 'Juan', job: 'backend' }
  const CRISTHOFER = {
    id: 'cristhofer',
    name: 'Cristhofer',
    job: 'Se encarga del front de las aplicaciónes, web, mobile, desktop.'
  }

  it('ranks the bot whose job names the subject first, whatever the language', () => {
    const ranked = rankBotsForRequest(
      'tengo como pendiente la tarea de analizar mejoras de front, pero no para hoy',
      [JUAN, CRISTHOFER]
    )
    expect(ranked.map((entry) => [entry.bot.id, entry.score])).toEqual([
      ['cristhofer', 1],
      ['juan', 0]
    ])
  })

  it('keeps team order when no job names the subject', () => {
    const ranked = rankBotsForRequest('Plan the spring season', [JUAN, CRISTHOFER])
    expect(ranked.map((entry) => entry.bot.id)).toEqual(['juan', 'cristhofer'])
    expect(ranked.every((entry) => entry.score === 0)).toBe(true)
  })
})

describe('findNamedProject', () => {
  const NEXUSCARE = { id: 'nexuscare', name: 'NexusCare' }
  const OPPM = { id: 'oppm', name: 'Oppm' }
  const MERIDA = { id: 'merida', name: 'Mérida' }

  it('finds a project named in the request, in any case', () => {
    expect(findNamedProject('Revisa el avance de nexuscare hoy', [NEXUSCARE, OPPM])).toBe(NEXUSCARE)
  })

  it('ignores accents on either side', () => {
    expect(findNamedProject('Haz el plan de merida', [MERIDA])).toBe(MERIDA)
  })

  it('is null when the request names no project', () => {
    expect(findNamedProject('Organiza la agenda del equipo', [NEXUSCARE, OPPM])).toBeNull()
  })

  it('prefers the longer name when two projects are named', () => {
    const CARE = { id: 'care', name: 'Care' }
    expect(findNamedProject('NexusCare y Care', [CARE, NEXUSCARE])).toBe(NEXUSCARE)
  })
})

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

describe('chooseBotTeamOwner', () => {
  it('leaves the owner open when no bot matches, so the room asks', () => {
    expect(chooseBotTeamOwner({ matchedBotIds: [], bots: BOTS, activeTasksByBot: {} })).toBeNull()
  })

  it('takes the only match even when it is busier', () => {
    expect(
      chooseBotTeamOwner({ matchedBotIds: ['max'], bots: BOTS, activeTasksByBot: { max: 5 } })
    ).toBe(MAX)
  })

  it('breaks a collision by the fewest active tasks', () => {
    expect(
      chooseBotTeamOwner({
        matchedBotIds: ['iris', 'max'],
        bots: BOTS,
        activeTasksByBot: { iris: 2, max: 1 }
      })
    ).toBe(MAX)
  })

  it('breaks an equal load by team order, so the choice is stable', () => {
    expect(
      chooseBotTeamOwner({ matchedBotIds: ['max', 'iris'], bots: BOTS, activeTasksByBot: {} })
    ).toBe(IRIS)
  })

  it('ignores an id that is not on the team', () => {
    expect(chooseBotTeamOwner({ matchedBotIds: ['ghost'], bots: BOTS, activeTasksByBot: {} })).toBe(
      null
    )
  })
})
