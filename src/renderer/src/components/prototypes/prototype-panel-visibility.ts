/**
 * The draft panel hides during a merge, whatever the preference. The list tree (in the left sidebar) hides
 * during a merge only when the user hid it for that merge; the sidebar itself is the app's own toggle.
 */
export function prototypePanelsShown(input: {
  sidePanelHidden: boolean
  listPanelHidden: boolean
  mergeUnderWay: boolean
}): { list: boolean; draft: boolean } {
  return {
    list: !(input.listPanelHidden && input.mergeUnderWay),
    draft: !(input.sidePanelHidden || input.mergeUnderWay)
  }
}
