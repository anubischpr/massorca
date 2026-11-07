import { describe, expect, it } from 'vitest'
import {
  createBotTeamRoutine,
  setBotTeamRoutinePaused
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { findSimilarBotTeamRoutine } from './bot-team-similar-routine'

// Tuesday 3 Nov 2026, 11:00 on the host's clock.
const NOW = new Date(2026, 10, 3, 11, 0).getTime()

function setup() {
  const db = new OrchestrationDb(':memory:')
  const team = db.createBotTeam({
    name: 'Web',
    purpose: '',
    character: 'circle',
    workspacesEnabled: false,
    bots: [
      { name: 'Ana', job: 'Front-end developer', agent: 'claude' },
      { name: 'Leo', job: 'Back-end developer', agent: 'codex' }
    ]
  })
  const [ana, leo] = team.bots
  const once = (date: string, time = '10:00') => ({
    frequency: 'once' as const,
    time,
    weekday: null,
    monthDay: null,
    date,
    timeZone: null
  })
  const routine = (botId: string, name: string, schedule = once('2026-11-04')) =>
    createBotTeamRoutine(db, { teamId: team.id, botId, name, prompt: name, schedule }, NOW)
  return { db, team, ana: ana!, leo: leo!, once, routine }
}

describe('finding the routine a one-time request is like', () => {
  it('finds the same bot’s one-time routine whose work words the request shares, whatever day it names', () => {
    const { db, team, ana, routine } = setup()
    const existing = routine(ana.id, 'Revisa el front de la web')
    const found = findSimilarBotTeamRoutine(db, {
      teamId: team.id,
      title: 'Revisa el front, pasado mañana a las 15'
    })
    expect(found?.id).toBe(existing.id)
  })

  it('offers a teammate’s routine too, since the room may have routed the first request elsewhere', () => {
    const { db, team, leo, routine } = setup()
    const made = routine(leo.id, 'Revisa el front de la web')
    expect(findSimilarBotTeamRoutine(db, { teamId: team.id, title: 'Revisa el front' })?.id).toBe(
      made.id
    )
  })

  it('never offers a paused routine, a recurring one, or one that already passed', () => {
    const { db, team, ana, once, routine } = setup()
    const paused = routine(ana.id, 'Revisa el front de la web')
    setBotTeamRoutinePaused(db, paused.id, true, NOW)
    createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: ana.id,
        name: 'Revisa el front cada día',
        prompt: 'Revisa el front cada día',
        schedule: {
          frequency: 'daily',
          time: '09:00',
          weekday: null,
          monthDay: null,
          date: null,
          timeZone: null
        }
      },
      NOW
    )
    routine(ana.id, 'Revisa el front del lunes', once('2026-11-01'))
    expect(findSimilarBotTeamRoutine(db, { teamId: team.id, title: 'Revisa el front' })).toBeNull()
  })

  it('offers the closest of several similar routines, and nothing for a title that differs', () => {
    const { db, team, ana, routine } = setup()
    const closest = routine(ana.id, 'Revisa el front')
    routine(ana.id, 'Revisa el front de la web y las pruebas de humo')
    expect(findSimilarBotTeamRoutine(db, { teamId: team.id, title: 'Revisa el front' })?.id).toBe(
      closest.id
    )
    expect(
      findSimilarBotTeamRoutine(db, {
        teamId: team.id,
        title: 'Revisión del backend'
      })
    ).toBeNull()
  })

  it('finds nothing for a title made only of a day and a time', () => {
    const { db, team, ana, routine } = setup()
    routine(ana.id, 'Revisa el front')
    expect(findSimilarBotTeamRoutine(db, { teamId: team.id, title: 'mañana a las 10' })).toBeNull()
  })
})
