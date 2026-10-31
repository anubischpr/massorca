/** A merge under way hides the draft, and the list only if hidden for it; preferences stay untouched. */
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
