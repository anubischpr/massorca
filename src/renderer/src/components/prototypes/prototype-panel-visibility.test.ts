import { describe, expect, it } from 'vitest'
import { prototypePanelsShown } from './prototype-panel-visibility'

describe('prototypePanelsShown', () => {
  it('shows both columns with no merge and no hidden preference', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: false, mergeUnderWay: false })
    ).toEqual({ list: true, draft: true })
  })

  it('hides the draft panel during a merge, whatever the preference', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: false, mergeUnderWay: true })
    ).toEqual({ list: true, draft: false })
  })

  it('hides the list during a merge only when the user hid it for that merge', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: true, mergeUnderWay: true })
    ).toEqual({ list: false, draft: false })
  })

  it('brings each column back as its preference says once the merge ends', () => {
    expect(
      prototypePanelsShown({ sidePanelHidden: false, listPanelHidden: true, mergeUnderWay: false })
    ).toEqual({ list: true, draft: true })
    expect(
      prototypePanelsShown({ sidePanelHidden: true, listPanelHidden: false, mergeUnderWay: false })
    ).toEqual({ list: true, draft: false })
  })
})
