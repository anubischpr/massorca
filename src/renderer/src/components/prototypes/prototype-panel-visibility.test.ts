import { describe, expect, it } from 'vitest'
import { prototypePanelsShown } from './prototype-panel-visibility'

describe('prototypePanelsShown', () => {
  it('shows both columns with no merge and no hidden preference', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: false, mergeUnderWay: false, sidebarOpen: true })
    ).toEqual({ list: true, draft: true })
  })

  it('hides the draft panel during a merge, whatever the preference', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: false, mergeUnderWay: true, sidebarOpen: true })
    ).toEqual({ list: true, draft: false })
  })

  it('hides the list during a merge only when the user hid it for that merge', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: true, mergeUnderWay: true, sidebarOpen: true })
    ).toEqual({ list: false, draft: false })
  })

  it('hides the list while the app sidebar is collapsed, as Workspaces hides its sidebar', () => {
    expect(
      prototypePanelsShown({
        sidePanelHidden: false,
        listPanelHidden: false,
        mergeUnderWay: false,
        sidebarOpen: false
      })
    ).toEqual({ list: false, draft: true })
  })

  it('brings each column back as its preference says once the merge ends', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: true, mergeUnderWay: false, sidebarOpen: true })
    ).toEqual({ list: true, draft: true })
    expect(
      prototypePanelsShown({ sidePanelHidden: true, listPanelHidden: false, mergeUnderWay: false, sidebarOpen: true })
    ).toEqual({ list: true, draft: false })
  })
})
