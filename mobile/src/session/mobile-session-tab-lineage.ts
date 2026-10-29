import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { MobileSessionTab } from './mobile-session-route-types'
import { paneTabIdOfPaneKey, type WorktreeAgentPane } from './mobile-worktree-agent-rows'

function tabOwnsPane(tab: MobileSessionTab, paneKey: string): boolean {
  switch (tab.type) {
    case 'agent-session':
      return paneTabIdOfPaneKey(paneKey) === structuredAgentSessionTabId(tab.sessionId)
    case 'terminal': {
      const tabId = tab.parentTabId ?? tab.id
      // Why: a split terminal's leaves share one tab id, so a leaf is matched by its whole pane key.
      return tab.leafId !== undefined
        ? paneKey === `${tabId}:${tab.leafId}`
        : paneTabIdOfPaneKey(paneKey) === tabId
    }
    default:
      return false
  }
}

/** Child tab id to parent tab id, read from each pane's spawning pane. One level only: a parent that
 *  is itself a child stays flat, so the sheet never nests deeper than a single indent. */
export function mobileSessionChildParentTabIds(
  tabs: readonly MobileSessionTab[],
  panes: readonly WorktreeAgentPane[]
): ReadonlyMap<string, string> {
  const tabIdOfPane = (paneKey: string) => tabs.find((tab) => tabOwnsPane(tab, paneKey))?.id
  const parentByChild = new Map<string, string>()
  for (const pane of panes) {
    if (!pane.parentPaneKey) {
      continue
    }
    const childTabId = tabIdOfPane(pane.paneKey)
    const parentTabId = tabIdOfPane(pane.parentPaneKey)
    if (childTabId && parentTabId && childTabId !== parentTabId && !parentByChild.has(childTabId)) {
      parentByChild.set(childTabId, parentTabId)
    }
  }
  const childTabIds = new Set(parentByChild.keys())
  return new Map([...parentByChild].filter(([, parentTabId]) => !childTabIds.has(parentTabId)))
}

export type SessionRowGroup<Row extends { tab: MobileSessionTab }> = {
  row: Row
  children: Row[]
}

/** Rows as root groups, each child under its parent in row order. A child whose parent is not in
 *  `rows` stays a root, so a missing link never hides a tab. */
export function groupSessionRowsByParent<Row extends { tab: MobileSessionTab }>(
  rows: readonly Row[],
  parentTabIds: ReadonlyMap<string, string>
): SessionRowGroup<Row>[] {
  const presentTabIds = new Set(rows.map((row) => row.tab.id))
  const presentParentByChild = new Map<string, string>()
  for (const row of rows) {
    const parentTabId = parentTabIds.get(row.tab.id)
    if (parentTabId !== undefined && presentTabIds.has(parentTabId)) {
      presentParentByChild.set(row.tab.id, parentTabId)
    }
  }
  // Why: one level only, as in mobileSessionChildParentTabIds; a child of a child stays a root, never hidden.
  const isChild = (row: Row) => {
    const parentTabId = presentParentByChild.get(row.tab.id)
    return parentTabId !== undefined && !presentParentByChild.has(parentTabId)
  }
  return rows
    .filter((row) => !isChild(row))
    .map((row) => ({
      row,
      children: rows.filter(
        (child) => isChild(child) && presentParentByChild.get(child.tab.id) === row.tab.id
      )
    }))
}
