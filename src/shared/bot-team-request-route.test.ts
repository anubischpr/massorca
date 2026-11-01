import { describe, expect, it } from 'vitest'
import { botTeamTaskTitle, routeBotTeamRequest } from './bot-team-request-route'

const IRIS = { id: 'iris', name: 'Iris' }
const MAX = { id: 'max', name: 'Max' }

describe('routeBotTeamRequest', () => {
  it('gives the request to the mentioned bot', () => {
    expect(routeBotTeamRequest('@max fix the table', [IRIS, MAX])).toBe(MAX)
  })

  it('gives it to the only bot of a team, with no mention needed', () => {
    expect(routeBotTeamRequest('draft a flyer', [IRIS])).toBe(IRIS)
  })

  it('leaves it open with several bots and no mention, so the room asks', () => {
    expect(routeBotTeamRequest('draft a flyer', [IRIS, MAX])).toBeNull()
  })

  it('leaves it open for a team with no bots', () => {
    expect(routeBotTeamRequest('draft a flyer', [])).toBeNull()
  })
})

describe('botTeamTaskTitle', () => {
  it('uses the first line without the mention', () => {
    expect(botTeamTaskTitle('@Iris draft a flyer\nwith prices', [IRIS])).toBe('draft a flyer')
  })

  it('shortens a long request', () => {
    const title = botTeamTaskTitle('x'.repeat(200), [])
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith('…')).toBe(true)
  })

  it('keeps the text when it is only a mention', () => {
    expect(botTeamTaskTitle('@Iris', [IRIS])).toBe('@Iris')
  })
})
