import { describe, expect, it } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { botTeamForFolderPath } from './bot-team-folder-team'

const TEAM: BotTeam = {
  id: 'team_ac38387ae1a7',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: true,
  accessMode: 'default',
  bots: []
}
const TEAM_FOLDER = 'C:\\Users\\palom\\MassOrca Bot Teams\\team_ac38387ae1a7'

describe('the team a team folder row is named for', () => {
  it('is the team whose folder it is, once the team list is loaded', () => {
    expect(botTeamForFolderPath([TEAM], TEAM_FOLDER)).toBe(TEAM)
  })

  it('is none while the team list is not loaded yet', () => {
    expect(botTeamForFolderPath(null, TEAM_FOLDER)).toBeNull()
  })

  it('is none for a team that is gone, or for a folder that is not a team folder', () => {
    expect(botTeamForFolderPath([], TEAM_FOLDER)).toBeNull()
    expect(botTeamForFolderPath([TEAM], 'C:\\Users\\palom\\Projects\\massorca')).toBeNull()
  })
})
