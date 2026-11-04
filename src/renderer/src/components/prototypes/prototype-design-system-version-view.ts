// The Versions part of a design system's view: which panel the aside shows, and the earlier version on screen.
// Each transition is a function of the state, so the screen only renders what these return.

export type DesignSystemVersionView = {
  /** The aside's panel: the Draft, or the Versions list that also lists earlier versions to preview. */
  panel: 'draft' | 'versions'
  /** The earlier version the content shows, read-only; null while the current one is shown. */
  preview: number | null
}

export const NO_DESIGN_SYSTEM_VERSION_VIEW: DesignSystemVersionView = {
  panel: 'draft',
  preview: null
}

/** Why: a preview is only ever shown beside the Versions list, so the Draft drops it. */
export function openDraftPanel(view: DesignSystemVersionView): DesignSystemVersionView {
  return { ...view, panel: 'draft', preview: null }
}

export function openVersionsPanel(view: DesignSystemVersionView): DesignSystemVersionView {
  return { ...view, panel: 'versions' }
}

export function previewDesignSystemVersion(
  view: DesignSystemVersionView,
  version: number
): DesignSystemVersionView {
  return { ...view, panel: 'versions', preview: version }
}

export function backToCurrentVersion(view: DesignSystemVersionView): DesignSystemVersionView {
  return { ...view, preview: null }
}
