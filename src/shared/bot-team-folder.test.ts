import { describe, expect, it } from 'vitest'
import {
  botTeamIdFromFolderPath,
  isBotTeamFolderPath,
  isBotTeamFolderShown
} from './bot-team-folder'

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

describe('botTeamIdFromFolderPath', () => {
  it('reads the team id that follows the teams folder', () => {
    expect(botTeamIdFromFolderPath('C:\\Users\\a\\MassOrca Bot Teams\\team_1')).toBe('team_1')
    expect(botTeamIdFromFolderPath('/home/a/MassOrca Bot Teams/team_1/')).toBe('team_1')
  })

  it('returns null when no team id follows the teams folder', () => {
    expect(botTeamIdFromFolderPath('/home/a/projects/site')).toBeNull()
    expect(botTeamIdFromFolderPath('/home/a/MassOrca Bot Teams')).toBeNull()
    expect(botTeamIdFromFolderPath('/home/a/MassOrca Bot Teams/')).toBeNull()
  })
})

describe('isBotTeamFolderShown', () => {
  it('shows a team folder only while its team has Workspaces on', () => {
    const on = new Set(['team_1'])
    expect(isBotTeamFolderShown('/home/a/MassOrca Bot Teams/team_1', on)).toBe(true)
    expect(isBotTeamFolderShown('/home/a/MassOrca Bot Teams/team_2', on)).toBe(false)
    expect(isBotTeamFolderShown('/home/a/MassOrca Bot Teams', on)).toBe(false)
  })

  it('leaves every other folder shown', () => {
    expect(isBotTeamFolderShown('/home/a/projects/site', new Set())).toBe(true)
  })
})
