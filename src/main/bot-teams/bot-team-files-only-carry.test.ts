import { describe, expect, it } from 'vitest'
import type { BotTeamRoomAttachment } from '../../shared/bot-team-room-attachments'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import { botTeamFilesAwaitingInstruction, botTeamRequestFiles } from './bot-team-files-only-carry'

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }
const LOGO = { path: 'attachments/logo.png', name: 'logo.png' }
const IRIS = 'iris'

function message(
  id: string,
  text: string,
  authorBotId: string | null,
  attachments?: BotTeamRoomAttachment[]
): BotTeamMessage {
  return { id, teamId: 'team', authorBotId, text, ...(attachments ? { attachments } : {}) }
}
const filesFrom = (id: string, file: BotTeamRoomAttachment) =>
  message(id, `Files attached: ${file.name}`, null, [file])
const askedAbout = (id: string, file: BotTeamRoomAttachment) =>
  message(id, `What do you want me to do with ${file.name}?`, IRIS)

describe('botTeamFilesAwaitingInstruction', () => {
  it('hands back the files of a files-only line the room asked about', () => {
    expect(
      botTeamFilesAwaitingInstruction([filesFrom('1', FLYER), askedAbout('2', FLYER)])
    ).toEqual([FLYER])
  })

  it('keeps each files-only line the room asked about, oldest first', () => {
    const messages = [
      filesFrom('1', FLYER),
      askedAbout('2', FLYER),
      filesFrom('3', LOGO),
      askedAbout('4', LOGO)
    ]
    expect(botTeamFilesAwaitingInstruction(messages)).toEqual([FLYER, LOGO])
  })

  it('reads past a bot line that is not a question', () => {
    const messages = [filesFrom('1', FLYER), askedAbout('2', FLYER), message('3', 'On it.', IRIS)]
    expect(botTeamFilesAwaitingInstruction(messages)).toEqual([FLYER])
  })

  it('hands back nothing for files nobody asked about', () => {
    expect(botTeamFilesAwaitingInstruction([filesFrom('1', FLYER)])).toEqual([])
    expect(
      botTeamFilesAwaitingInstruction([filesFrom('1', FLYER), message('2', 'Listo', IRIS)])
    ).toEqual([])
  })

  it('stops at the most recent words of the person', () => {
    const messages = [filesFrom('1', FLYER), askedAbout('2', FLYER), message('3', 'hola', null)]
    expect(botTeamFilesAwaitingInstruction(messages)).toEqual([])
  })

  it('does not carry a line that has words of its own', () => {
    const withWords = message('1', 'Haz el flyer', null, [FLYER])
    expect(botTeamFilesAwaitingInstruction([withWords, askedAbout('2', FLYER)])).toEqual([])
  })

  it('reads a line of only a bot mention with its files as files-only', () => {
    const mentionOnly = message('1', '@Iris', null, [FLYER])
    expect(botTeamFilesAwaitingInstruction([mentionOnly, askedAbout('2', FLYER)])).toEqual([FLYER])
  })
})

describe('botTeamRequestFiles', () => {
  it('reads a files-only line with its own files alone', () => {
    expect(botTeamRequestFiles('Files attached: logo.png', [LOGO], [FLYER])).toEqual([LOGO])
  })

  it('reads words with the files still waiting before them, each file once', () => {
    expect(botTeamRequestFiles('Resúmelo', [LOGO], [FLYER, LOGO])).toEqual([FLYER, LOGO])
  })

  it('reads words that name no file of their own with the waiting files', () => {
    expect(botTeamRequestFiles('Resúmelo', [], [FLYER])).toEqual([FLYER])
  })

  it('reads a line of only a bot mention with the waiting files, so it is asked about', () => {
    expect(botTeamRequestFiles('@Iris', [], [FLYER])).toEqual([FLYER])
  })

  it('stays empty when there are no files of its own and none waiting', () => {
    expect(botTeamRequestFiles('Resúmelo', [], [])).toEqual([])
  })
})
