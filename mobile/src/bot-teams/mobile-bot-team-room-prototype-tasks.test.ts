import { describe, expect, it } from 'vitest'
import { botTeamRoomPrototypeTasks } from './mobile-bot-team-room-prototype-tasks'

function post(id: string, authorBotId: string | null, createdAt: number, fromTeamId?: string) {
  return { id, authorBotId, createdAt, ...(fromTeamId ? { fromTeamId } : {}) }
}

function task(id: string, createdAt: number | null, sessionId: string | null = `s-${id}`) {
  return { id, teamId: 'team', ownerBotId: 'bot', sessionId, createdAt }
}

function ids(map: ReadonlyMap<string, { id: string }[]>) {
  return Object.fromEntries(
    [...map].map(([messageId, tasks]) => [messageId, tasks.map((t) => t.id)])
  )
}

describe('botTeamRoomPrototypeTasks', () => {
  it('puts a task under its owner bot latest post since it was made, not under every post', () => {
    const messages = [
      post('ask', null, 10),
      post('ack', 'bot', 11),
      post('other-bot', 'bot-2', 12),
      post('done', 'bot', 20)
    ]
    expect(ids(botTeamRoomPrototypeTasks(messages, [task('t1', 10)], 'team'))).toEqual({
      done: ['t1']
    })
  })

  it('keeps a task under its own posts when the bot later takes another task', () => {
    const messages = [post('t1-done', 'bot', 15), post('t2-done', 'bot', 25)]
    const map = botTeamRoomPrototypeTasks(messages, [task('t1', 10), task('t2', 20)], 'team')
    expect(ids(map)).toEqual({ 't1-done': ['t1'], 't2-done': ['t2'] })
  })

  it('falls back to a later post when the bot wrote nothing before its next task', () => {
    const messages = [post('late', 'bot', 25)]
    const map = botTeamRoomPrototypeTasks(messages, [task('t1', 10), task('t2', 20)], 'team')
    expect(ids(map)).toEqual({ late: ['t1', 't2'] })
  })

  it('skips a task with no session, no time, or no post by its bot after it', () => {
    const messages = [post('before', 'bot', 5)]
    const tasks = [task('todo', 10, null), task('old-host', null), task('silent', 10)]
    expect(botTeamRoomPrototypeTasks(messages, tasks, 'team').size).toBe(0)
  })

  it('matches another team report only to that team task', () => {
    const messages = [post('report', 'bot', 30, 'team-2'), post('own', 'bot', 31)]
    const sent = { ...task('sent', 10), teamId: 'team-2' }
    expect(ids(botTeamRoomPrototypeTasks(messages, [sent], 'team'))).toEqual({ report: ['sent'] })
  })
})
