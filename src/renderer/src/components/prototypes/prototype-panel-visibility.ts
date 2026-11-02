/** A merge under way hides the draft, and the list only if hidden for it; preferences stay untouched. */
export function prototypePanelsShown(input: {
  sidePanelHidden: boolean
  listPanelHidden: boolean
  mergeUnderWay: boolean
  /** The app's left-sidebar toggle, the same one Workspaces uses. */
  sidebarOpen: boolean
}): { list: boolean; draft: boolean } {
  return {
    list: input.sidebarOpen && !(input.listPanelHidden && input.mergeUnderWay),
    draft: !(input.sidePanelHidden || input.mergeUnderWay)
  }
}
