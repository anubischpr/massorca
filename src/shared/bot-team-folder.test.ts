import { describe, expect, it } from 'vitest'
import { isBotTeamFolderPath } from './bot-team-folder'

describe('isBotTeamFolderPath', () => {
  it('recognizes a team folder on Windows and POSIX hosts', () => {
    expect(isBotTeamFolderPath('C:\\Users\\a\\MassOrca Bot Teams\\team_1')).toBe(true)
    expect(isBotTeamFolderPath('/home/a/MassOrca Bot Teams/team_1')).toBe(true)
  })

  it('leaves other folders alone, including a similar name', () => {
    expect(isBotTeamFolderPath('/home/a/projects/site')).toBe(false)
    expect(isBotTeamFolderPath('/home/a/MassOrca Bot Teams old/x')).toBe(false)
  })
})
