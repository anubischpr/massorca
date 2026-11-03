import { describe, expect, it } from 'vitest'
import {
  applyDesktopViewSettings,
  buildWorkspaceViewSettingsUpdate,
  type MobileViewState
} from './workspace-view-settings'

const CURRENT: MobileViewState = {
  groupMode: 'none',
  sortMode: 'recent',
  hideSleeping: false,
  hideDefaultBranch: false,
  alwaysShowDefaultBranch: true,
  filterRepoIds: [],
  collapsedGroups: [],
  workspaceStatuses: [],
  showBotTeamWorkspaces: false
}

describe('Show bot teams in the phone view settings', () => {
  it('reads the desktop switch and keeps it when a payload omits it (an older desktop never sends it)', () => {
    expect(
      applyDesktopViewSettings(CURRENT, { showBotTeamWorkspaces: true }).showBotTeamWorkspaces
    ).toBe(true)
    expect(
      applyDesktopViewSettings({ ...CURRENT, showBotTeamWorkspaces: true }, {})
        .showBotTeamWorkspaces
    ).toBe(true)
  })

  it('is off on a phone that has never heard from a desktop with the switch', () => {
    const { showBotTeamWorkspaces: _unset, ...fresh } = CURRENT
    expect(applyDesktopViewSettings(fresh, {}).showBotTeamWorkspaces).toBeFalsy()
  })

  it('sends only the switch when that is the only field the user touched', () => {
    const next = { ...CURRENT, showBotTeamWorkspaces: true }
    expect(buildWorkspaceViewSettingsUpdate({ showBotTeamWorkspaces: true }, next)).toEqual({
      showBotTeamWorkspaces: true
    })
  })
})
