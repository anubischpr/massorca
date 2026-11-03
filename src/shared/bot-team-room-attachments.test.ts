import { describe, expect, it } from 'vitest'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  botTeamRoomAttachmentsNote,
  encodeBotTeamRoomAttachments,
  isBotTeamRoomAttachmentPath,
  splitBotTeamRoomAttachments
} from './bot-team-room-attachments'

describe('bot team room attachments', () => {
  it('keeps a message with no files exactly as written', () => {
    expect(encodeBotTeamRoomAttachments('Hola equipo', [])).toBe('Hola equipo')
    expect(splitBotTeamRoomAttachments('Hola equipo')).toEqual({
      text: 'Hola equipo',
      attachments: []
    })
  })

  it('stores files with the message and reads both back apart', () => {
    const attachments = [
      { path: 'attachments/plan.pdf', name: 'plan.pdf' },
      { path: 'attachments/a<b>&c.png', name: 'a<b>&c.png' }
    ]
    const stored = encodeBotTeamRoomAttachments('Revisad -->  esto', attachments)
    expect(splitBotTeamRoomAttachments(stored)).toEqual({
      text: 'Revisad -->  esto',
      attachments
    })
  })

  it('reads a marker it cannot parse as ordinary text', () => {
    const broken = 'Hola\n<!-- orca-room-attachments [not json] -->'
    expect(splitBotTeamRoomAttachments(broken)).toEqual({ text: broken, attachments: [] })
  })

  it('drops entries whose path is outside the attachments folder', () => {
    const stored = encodeBotTeamRoomAttachments('Hola', [
      { path: 'attachments/ok.txt', name: 'ok.txt' },
      { path: '../secret.txt', name: 'secret.txt' }
    ])
    expect(splitBotTeamRoomAttachments(stored).attachments).toEqual([
      { path: 'attachments/ok.txt', name: 'ok.txt' }
    ])
  })

  it('accepts only one-level relative paths inside the attachments folder', () => {
    expect(isBotTeamRoomAttachmentPath('attachments/a.png')).toBe(true)
    expect(isBotTeamRoomAttachmentPath('attachments/sub/a.png')).toBe(false)
    expect(isBotTeamRoomAttachmentPath('attachments/..')).toBe(false)
    expect(isBotTeamRoomAttachmentPath('/attachments/a.png')).toBe(false)
    expect(isBotTeamRoomAttachmentPath('C:/attachments/a.png')).toBe(false)
    expect(isBotTeamRoomAttachmentPath('attachments\\a.png')).toBe(false)
    expect(isBotTeamRoomAttachmentPath('notes/a.png')).toBe(false)
  })

  it('caps a message at ten files', () => {
    expect(BOT_TEAM_ROOM_ATTACHMENT_LIMIT).toBe(10)
  })

  it('lists the attached paths for the bots, and nothing when there are none', () => {
    expect(botTeamRoomAttachmentsNote([])).toBeNull()
    expect(
      botTeamRoomAttachmentsNote([
        { path: 'attachments/a.png', name: 'a.png' },
        { path: 'attachments/b.pdf', name: 'b.pdf' }
      ])
    ).toBe('Files attached to the team folder: attachments/a.png, attachments/b.pdf')
  })
})
