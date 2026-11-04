import { describe, expect, it } from 'vitest'
import {
  backToCurrentVersion,
  NO_DESIGN_SYSTEM_VERSION_VIEW,
  openDraftPanel,
  openVersionsPanel,
  previewDesignSystemVersion
} from './prototype-design-system-version-view'

describe('design system version view', () => {
  it('starts on the Draft with no earlier version on screen', () => {
    expect(NO_DESIGN_SYSTEM_VERSION_VIEW).toEqual({ panel: 'draft', preview: null })
  })

  it('swaps the aside to the Versions list and keeps any preview', () => {
    const previewing = previewDesignSystemVersion(NO_DESIGN_SYSTEM_VERSION_VIEW, 3)
    expect(openVersionsPanel(previewing)).toEqual({ panel: 'versions', preview: 3 })
  })

  it('previewing an earlier version opens the Versions list with it on screen', () => {
    expect(previewDesignSystemVersion(NO_DESIGN_SYSTEM_VERSION_VIEW, 2)).toEqual({
      panel: 'versions',
      preview: 2
    })
  })

  it('going back to the Draft ends the preview', () => {
    const previewing = previewDesignSystemVersion(NO_DESIGN_SYSTEM_VERSION_VIEW, 2)
    expect(openDraftPanel(previewing)).toEqual({ panel: 'draft', preview: null })
  })

  it('back to current ends the preview and keeps the Versions list', () => {
    const previewing = previewDesignSystemVersion(NO_DESIGN_SYSTEM_VERSION_VIEW, 2)
    expect(backToCurrentVersion(previewing)).toEqual({ panel: 'versions', preview: null })
  })
})
