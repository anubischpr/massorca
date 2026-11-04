import { describe, expect, it } from 'vitest'
import {
  botTeamClassifyScheduledMoment,
  botTeamRequestScheduledMoment
} from './bot-team-request-schedule'

// Tuesday 3 Nov 2026, 11:00 on the host's clock.
const NOW = new Date(2026, 10, 3, 11, 0).getTime()
const read = (text: string) => botTeamRequestScheduledMoment(text, NOW)

describe('the day and time a room request asks for', () => {
  it('reads tomorrow, at 09:00 when no time is named', () => {
    expect(read('Quiero que programen para mañana en Todo una revisión del front')).toEqual({
      date: '2026-11-04',
      time: '09:00'
    })
    expect(read('Schedule a front review for tomorrow at 3pm')).toEqual({
      date: '2026-11-04',
      time: '15:00'
    })
    expect(read('pasado mañana a las 10:30 revisen el copy')).toEqual({
      date: '2026-11-05',
      time: '10:30'
    })
  })

  it('reads a weekday as the next one, and an afternoon hour as such', () => {
    expect(read('programen el lunes a las 4 de la tarde una demo')).toEqual({
      date: '2026-11-09',
      time: '16:00'
    })
    // Today is Tuesday: "on Tuesday" is next week's.
    expect(read('Schedule the report on Tuesday')).toEqual({ date: '2026-11-10', time: '09:00' })
  })

  it('reads a written date and today with a later time', () => {
    expect(read('programen para el 2026-11-20 a las 08:00 el cierre')).toEqual({
      date: '2026-11-20',
      time: '08:00'
    })
    expect(read('programen para el 15/11 la revisión')).toEqual({
      date: '2026-11-15',
      time: '09:00'
    })
    expect(read('hoy a las 17 revisen el front')).toEqual({ date: '2026-11-03', time: '17:00' })
  })

  it('names no moment without a day, for a past one, or for this morning', () => {
    expect(read('revisen el front más tarde')).toBeNull()
    // A day with no word asking to schedule it, and no time, is only filed in Todo.
    expect(read('Design a flyer para mañana, agrégalo al Todo')).toBeNull()
    expect(read('programen para hoy la revisión')).toBeNull()
    expect(read('hoy a las 9 revisen el front')).toBeNull()
    expect(read('esta mañana falló el front, revísenlo')).toBeNull()
    expect(read('a las 10 revisen el front')).toBeNull()
    expect(read('programen para el 31/02 la revisión')).toBeNull()
  })

  it("reads tomorrow on the sender's clock, not the host's", () => {
    // 23:30 UTC on 3 Nov is already 4 Nov in Tokyo.
    const late = Date.UTC(2026, 10, 3, 23, 30)
    expect(botTeamRequestScheduledMoment('programen para mañana', late, 'Asia/Tokyo')).toEqual({
      date: '2026-11-05',
      time: '09:00'
    })
    expect(
      botTeamRequestScheduledMoment('programen para mañana', late, 'America/Los_Angeles')
    ).toEqual({ date: '2026-11-04', time: '09:00' })
  })

  it('takes the moment the query read, only when it is a real future one', () => {
    expect(
      botTeamClassifyScheduledMoment('{"kind":"bot","bots":["Ana"],"when":"2026-11-04 10:00"}', NOW)
    ).toEqual({
      date: '2026-11-04',
      time: '10:00'
    })
    expect(
      botTeamClassifyScheduledMoment('{"kind":"bot","when":"2026-11-02 10:00"}', NOW)
    ).toBeNull()
    expect(botTeamClassifyScheduledMoment('{"kind":"bot","when":"soon"}', NOW)).toBeNull()
    expect(botTeamClassifyScheduledMoment('{"kind":"bot"}', NOW)).toBeNull()
  })
})
