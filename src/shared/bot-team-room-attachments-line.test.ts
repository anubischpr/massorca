import { describe, expect, it } from 'vitest'
import {
  botTeamFileNamesText,
  botTeamFilesOnlyText,
  isBotTeamFilesOnlyText
} from './bot-team-room-attachments-line'

const files = [
  { path: 'attachments/logo.png', name: 'logo.png' },
  { path: 'attachments/brief.pdf', name: 'brief.pdf' }
]

describe('isBotTeamFilesOnlyText', () => {
  it('recognizes the line the host files a message of only files with, in any language', () => {
    expect(isBotTeamFilesOnlyText(botTeamFilesOnlyText(files, 'hello'), files)).toBe(true)
    expect(isBotTeamFilesOnlyText(botTeamFilesOnlyText(files, 'hola, cómo estás'), files)).toBe(
      true
    )
  })

  it('recognizes the file names an older host was sent as text', () => {
    expect(isBotTeamFilesOnlyText(botTeamFileNamesText(files), files)).toBe(true)
  })

  it('keeps words the person typed, and a line with no files', () => {
    expect(isBotTeamFilesOnlyText('Use these for the flyer', files)).toBe(false)
    expect(isBotTeamFilesOnlyText('Files attached: logo.png', files)).toBe(false)
    expect(isBotTeamFilesOnlyText('Files attached: logo.png, brief.pdf', [])).toBe(false)
    expect(isBotTeamFilesOnlyText('logo.png, brief.pdf', undefined)).toBe(false)
  })
})
