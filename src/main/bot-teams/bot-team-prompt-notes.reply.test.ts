import { describe, expect, it } from 'vitest'
import { botTeamReplyNote } from './bot-team-prompt-notes'

describe('botTeamReplyNote', () => {
  it('names the bot whose message the reply answers, and quotes that message', () => {
    const note = botTeamReplyNote({
      authorName: 'Scout',
      text: 'Nobody else launches on Friday morning.'
    })
    expect(note).toContain("replying to Scout's message")
    expect(note).toContain('Nobody else launches on Friday morning.')
  })

  it("calls a quoted message the person's own when no bot wrote it", () => {
    const note = botTeamReplyNote({ authorName: null, text: 'Quiero un flyer para el viernes' })
    expect(note).toContain('their own earlier message')
    expect(note).toContain('Quiero un flyer para el viernes')
  })

  it('hands a topic far from the role to a teammate with the team-delegate command', () => {
    const note = botTeamReplyNote({ authorName: 'Scout', text: 'x' })
    expect(note).toContain('far from your job')
    expect(note).toContain('orca orchestration team-delegate --bot <name> --text "<task>"')
  })

  it('keeps a long quote short and flattens its line breaks', () => {
    const note = botTeamReplyNote({
      authorName: 'Scout',
      text: `first line\n\n${'word '.repeat(400)}`
    })
    expect(note).not.toContain('\n\n')
    expect(note).toContain('…')
    expect(note.length).toBeLessThan(900)
  })
})
