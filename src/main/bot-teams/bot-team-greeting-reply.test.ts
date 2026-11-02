import { afterEach, describe, expect, it } from 'vitest'
import { BOT_TEAM_ALL_AUTHOR } from '../../shared/bot-team-greeting'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { replyToBotTeamGreeting } from './bot-team-greeting-reply'

describe('replyToBotTeamGreeting', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function open() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
    })
    return { db, team }
  }

  it('answers a bare greeting once, from All, and makes no task', () => {
    const { db, team } = open()
    const reply = replyToBotTeamGreeting(db, { teamId: team.id, text: 'Hola!' })
    expect(reply).toMatchObject({ authorBotId: BOT_TEAM_ALL_AUTHOR, teamId: team.id })
    expect(reply?.text).toMatch(/\p{Emoji_Presentation}/u)
    expect(db.listBotTeamTasks(team.id)).toEqual([])
  })

  it('never repeats the last All line', () => {
    const { db, team } = open()
    const lines = new Set<string>()
    for (let n = 0; n < 12; n += 1) {
      const last = db.listBotTeamMessages(team.id).at(-1)?.text
      const reply = replyToBotTeamGreeting(db, { teamId: team.id, text: 'Hello', random: () => 0 })
      expect(reply?.text).not.toBe(last)
      lines.add(reply?.text ?? '')
    }
    expect(lines.size).toBeGreaterThan(1)
  })

  it('leaves a request that starts with a greeting, or a mention, to normal routing', () => {
    const { db, team } = open()
    expect(replyToBotTeamGreeting(db, { teamId: team.id, text: 'Hola, haz un flyer' })).toBeNull()
    expect(replyToBotTeamGreeting(db, { teamId: team.id, text: '@Iris hola' })).toBeNull()
    expect(replyToBotTeamGreeting(db, { teamId: team.id, text: '@Iris' })).toBeNull()
    expect(db.listBotTeamMessages(team.id)).toEqual([])
  })
})
