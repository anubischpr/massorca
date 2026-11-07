import { describe, expect, it } from 'vitest'
import { botTeamReplyNote, botTeamTaskRoomExcerpt } from './bot-team-prompt-notes'

const BOTS = [{ id: 'iris', name: 'Iris' }]
const MESSAGES = [
  { id: 'm1', teamId: 'team', authorBotId: null, text: 'hola', createdAt: 1 },
  { id: 'm2', teamId: 'team', authorBotId: 'iris', text: 'Listo', createdAt: 2 }
]

describe('a reply note that quotes the task behind the line', () => {
  it('names the task that posted the quoted line and gives its request', () => {
    const note = botTeamReplyNote({
      authorName: 'Iris',
      text: 'Listo, el flyer está listo.',
      sourceTask: { title: 'Flyer', prompt: 'Haz el flyer para el viernes', projectId: null }
    })

    expect(note).toContain('"Flyer"')
    expect(note).toContain('Haz el flyer para el viernes')
  })

  it('shortens a long request of that task', () => {
    const note = botTeamReplyNote({
      authorName: 'Iris',
      text: 'Listo',
      sourceTask: { title: 'Flyer', prompt: 'word '.repeat(600), projectId: null }
    })

    expect(note).toContain('…')
    expect(note.length).toBeLessThan(2000)
  })

  it('names no task when no task posted the quoted line', () => {
    const note = botTeamReplyNote({ authorName: 'Iris', text: 'Listo' })

    expect(note).not.toContain('came from the task')
  })
})

describe('the room lines a task reads', () => {
  it('gives a reply no room excerpt, since its notes quote the line it answers', () => {
    expect(botTeamTaskRoomExcerpt({ answersMessageId: 'm2' }, MESSAGES, BOTS)).toEqual([])
  })

  it('keeps the room excerpt for a task that answers no message', () => {
    expect(botTeamTaskRoomExcerpt({}, MESSAGES, BOTS)).toEqual(['Person: hola', 'Iris: Listo'])
  })
})
