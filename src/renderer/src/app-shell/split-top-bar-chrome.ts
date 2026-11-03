import { createContext, useContext } from 'react'
import type { TabGroup } from '../../../shared/tab-types'
import { selectLayoutWorktreeId } from '../store/slices/tabs/pane-session-ref'
import { isSidePanelGroupId } from '../store/slices/tabs/side-panel-group'
import type { AppState } from '../store/types'

export type SplitTopBarCollapsePane = { tabId: string; canExpand: boolean }

/** The window chrome the top row of each top pane in a split reserves for itself. */
export type SplitTopBarChrome = {
  worktreeId: string
  /** True when the window-controls overlay sits over the rightmost row's right end. */
  reserveWindowControls: boolean
  /** True when the collapsed left sidebar's floating header sits over the leftmost row's left end. */
  reserveCollapsedSidebarHeader: boolean
  collapsePane: SplitTopBarCollapsePane | null
}

const SplitTopBarChromeContext = createContext<SplitTopBarChrome | null>(null)

/** Provided by the workspace shell; null means no top rows render (single pane, floating panel, tests). */
export const SplitTopBarChromeProvider = SplitTopBarChromeContext.Provider

export function useSplitTopBarChrome(): SplitTopBarChrome | null {
  return useContext(SplitTopBarChromeContext)
}

/** Whether the main area of this workspace is split: its layout holds more than one main pane. */
export function selectMainAreaSplit(
  state: Pick<AppState, 'groupsByWorktree' | 'paneFocus' | 'activeWorktreeId'>,
  worktreeId: string
): boolean {
  const layoutWorktreeId = selectLayoutWorktreeId(state) ?? worktreeId
  const main = (state.groupsByWorktree[layoutWorktreeId] ?? []).filter(
    (group) => !isSidePanelGroupId(group.id)
  )
  return main.length > 1
}

export function findTabGroupById(
  state: Pick<AppState, 'groupsByWorktree'>,
  groupId: string
): TabGroup | undefined {
  for (const groups of Object.values(state.groupsByWorktree)) {
    const group = groups?.find((row) => row.id === groupId)
    if (group) {
      return group
    }
  }
  return undefined
}
