import { createBrowserUuid } from '@/lib/browser-uuid'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import type { AppState } from '../../types'
import type { Tab, TabGroup, TabGroupLayoutNode } from '../../../../../shared/tab-types'
import { dedupeTabOrder, sanitizeRecentTabIds } from '../tab-group-state'
import { collapseGroupLayout } from './tabs-layout'
import { applyTabOrderSortValues } from './tabs-tab-order'
import { buildActiveSurfacePatch } from './tabs-surface'

const SIDE_PANEL_GROUP_ID_PREFIX = 'side-panel:'
// Why: far past any real tab count, so tabs missing from every order sort after the ordered ones.
const UNORDERED_RANK = 1_000_000_000

/** The per-workspace group that owns every non-session tab; derived so no persisted field is needed. */
export function sidePanelGroupId(worktreeId: string): string {
  return `${SIDE_PANEL_GROUP_ID_PREFIX}${worktreeId}`
}

export function isSidePanelGroupId(groupId: string | null | undefined): boolean {
  return typeof groupId === 'string' && groupId.startsWith(SIDE_PANEL_GROUP_ID_PREFIX)
}

/** Sessions stay in the main area; agent terminals are the only terminals that carry a view mode. */
export function isSessionTab(tab: Pick<Tab, 'contentType' | 'viewMode'>): boolean {
  return (
    tab.contentType === 'agent-session' ||
    (tab.contentType === 'terminal' && tab.viewMode !== undefined)
  )
}

function layoutHasLeaf(layout: TabGroupLayoutNode, groupId: string): boolean {
  return layout.type === 'leaf'
    ? layout.groupId === groupId
    : layoutHasLeaf(layout.first, groupId) || layoutHasLeaf(layout.second, groupId)
}

function firstLeafGroupId(layout: TabGroupLayoutNode): string {
  return layout.type === 'leaf' ? layout.groupId : firstLeafGroupId(layout.first)
}

function withoutTabs(group: TabGroup, removed: ReadonlySet<string>): TabGroup {
  const tabOrder = dedupeTabOrder(group.tabOrder).filter((id) => !removed.has(id))
  const recentTabIds = sanitizeRecentTabIds(
    (group.recentTabIds ?? []).filter((id) => !removed.has(id)),
    tabOrder
  )
  const activeTabId =
    group.activeTabId && !removed.has(group.activeTabId)
      ? group.activeTabId
      : (recentTabIds.at(-1) ?? tabOrder[0] ?? null)
  return { ...group, tabOrder, recentTabIds, activeTabId }
}

function focusStamp(tab: Tab): number {
  return tab.lastFocusedAt ?? tab.createdAt
}

/**
 * Moves non-session tabs into the workspace's side panel group (and any session that ended up
 * there back to a main group). Returns null when the workspace already satisfies the invariant.
 */
export function planSidePanelNormalization(
  state: AppState,
  worktreeId: string
): Partial<AppState> | null {
  // Why: the floating workspace is its own tab surface and has no session/panel split.
  if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    return null
  }
  const storedTabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  // Why: an agent launch creates its terminal before any view mode is set, and a panel move in
  // between would strand the session there; the terminal row's launch agent names it a session.
  const launchedAgentTabIds = new Set(
    (state.tabsByWorktree[worktreeId] ?? []).flatMap((row) => (row.launchAgent ? [row.id] : []))
  )
  const needsViewMode = (tab: Tab): boolean =>
    tab.contentType === 'terminal' &&
    tab.viewMode === undefined &&
    launchedAgentTabIds.has(tab.entityId)
  const stamped = storedTabs.some(needsViewMode)
  const tabs = stamped
    ? storedTabs.map((tab) =>
        needsViewMode(tab) ? { ...tab, viewMode: 'terminal' as const } : tab
      )
    : storedTabs
  const groups = state.groupsByWorktree[worktreeId] ?? []
  const panelId = sidePanelGroupId(worktreeId)
  const layout = state.layoutByWorktree[worktreeId]
  const toPanel = tabs.filter((tab) => !isSessionTab(tab) && tab.groupId !== panelId)
  const toMain = tabs.filter((tab) => isSessionTab(tab) && tab.groupId === panelId)
  const layoutHasPanelLeaf = layout ? layoutHasLeaf(layout, panelId) : false
  if (toPanel.length === 0 && toMain.length === 0 && !layoutHasPanelLeaf) {
    return stamped
      ? { unifiedTabsByWorktree: { ...state.unifiedTabsByWorktree, [worktreeId]: tabs } }
      : null
  }

  const groupIndex = new Map(groups.map((group, index) => [group.id, index]))
  const rankById = new Map<string, number>()
  for (const group of groups) {
    const base = (groupIndex.get(group.id) ?? 0) * 10_000
    dedupeTabOrder(group.tabOrder).forEach((id, index) => rankById.set(id, base + index))
  }
  const rank = (tab: Tab): number => rankById.get(tab.id) ?? UNORDERED_RANK + tab.sortOrder
  const movedToPanel = [...toPanel].sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt)

  const mainGroups = groups.filter((group) => group.id !== panelId)
  const preferredMainId = layout && !layoutHasPanelLeaf ? firstLeafGroupId(layout) : undefined
  let mainTarget: TabGroup | null =
    mainGroups.find((group) => group.id === preferredMainId) ?? mainGroups[0] ?? null
  const createdMain = toMain.length > 0 && !mainTarget
  if (createdMain) {
    mainTarget = {
      id: createBrowserUuid(),
      worktreeId,
      activeTabId: null,
      tabOrder: [],
      recentTabIds: []
    }
  }

  const removedByGroup = new Map<string, Set<string>>()
  const markRemoved = (groupId: string, tabId: string): void => {
    const set = removedByGroup.get(groupId) ?? new Set<string>()
    set.add(tabId)
    removedByGroup.set(groupId, set)
  }
  for (const tab of toPanel) {
    markRemoved(tab.groupId, tab.id)
  }
  for (const tab of toMain) {
    markRemoved(panelId, tab.id)
  }

  const existingPanel = groups.find((group) => group.id === panelId)
  const activeInSource = movedToPanel.filter(
    (tab) => groups.find((group) => group.id === tab.groupId)?.activeTabId === tab.id
  )
  const activatedTab = [...activeInSource].sort((a, b) => focusStamp(b) - focusStamp(a))[0]

  let panel: TabGroup = withoutTabs(
    existingPanel ?? {
      id: panelId,
      worktreeId,
      activeTabId: null,
      tabOrder: [],
      recentTabIds: []
    },
    removedByGroup.get(panelId) ?? new Set()
  )
  const panelOrder = dedupeTabOrder([...panel.tabOrder, ...movedToPanel.map((tab) => tab.id)])
  panel = {
    ...panel,
    tabOrder: panelOrder,
    activeTabId: activatedTab?.id ?? panel.activeTabId ?? panelOrder[0] ?? null,
    recentTabIds: activatedTab
      ? [...sanitizeRecentTabIds(panel.recentTabIds, panelOrder), activatedTab.id]
      : sanitizeRecentTabIds(panel.recentTabIds, panelOrder)
  }

  const emptiedMainIds: string[] = []
  const nextMain = mainGroups.map((group) => {
    const removed = removedByGroup.get(group.id)
    let next = removed ? withoutTabs(group, removed) : group
    if (mainTarget && group.id === mainTarget.id && toMain.length > 0) {
      const order = dedupeTabOrder([...next.tabOrder, ...toMain.map((tab) => tab.id)])
      next = { ...next, tabOrder: order, activeTabId: next.activeTabId ?? toMain[0].id }
    }
    if (removed && next.tabOrder.length === 0) {
      emptiedMainIds.push(group.id)
    }
    return next
  })
  const createdMainGroup: TabGroup | null =
    createdMain && mainTarget
      ? {
          ...mainTarget,
          tabOrder: toMain.map((tab) => tab.id),
          activeTabId: toMain[0].id
        }
      : null
  const keptMain = [
    ...nextMain.filter((group) => !emptiedMainIds.includes(group.id)),
    ...(createdMainGroup ? [createdMainGroup] : [])
  ]

  let layoutByWorktree = state.layoutByWorktree
  let activeGroupIdByWorktree = state.activeGroupIdByWorktree
  const fallbackMainId = keptMain[0]?.id ?? null
  for (const groupId of [...emptiedMainIds, ...(layoutHasPanelLeaf ? [panelId] : [])]) {
    const collapsed = collapseGroupLayout(
      layoutByWorktree,
      activeGroupIdByWorktree,
      worktreeId,
      groupId,
      fallbackMainId
    )
    layoutByWorktree = collapsed.layoutByWorktree
    activeGroupIdByWorktree = collapsed.activeGroupIdByWorktree
  }
  if (keptMain.length > 0 && !layoutByWorktree[worktreeId]) {
    layoutByWorktree = {
      ...layoutByWorktree,
      [worktreeId]: { type: 'leaf', groupId: keptMain[0].id }
    }
  }

  const previousActiveGroupId = state.activeGroupIdByWorktree[worktreeId]
  const keptIds = new Set([panelId, ...keptMain.map((group) => group.id)])
  const userWasOnMovedTab =
    activatedTab !== undefined && activatedTab.groupId === previousActiveGroupId
  const nextActiveGroupId = userWasOnMovedTab
    ? panelId
    : previousActiveGroupId && keptIds.has(previousActiveGroupId)
      ? previousActiveGroupId
      : (fallbackMainId ?? panelId)
  activeGroupIdByWorktree = { ...activeGroupIdByWorktree, [worktreeId]: nextActiveGroupId }

  const hasPanelTabs = panel.tabOrder.length > 0
  const nextGroups = [...keptMain, ...(hasPanelTabs || existingPanel ? [panel] : [])]
  const movedToMainIds = new Set(toMain.map((tab) => tab.id))
  const movedToPanelIds = new Set(movedToPanel.map((tab) => tab.id))
  const mainTargetId = createdMainGroup?.id ?? mainTarget?.id
  let nextTabs = tabs.map((tab) => {
    if (movedToPanelIds.has(tab.id)) {
      return { ...tab, groupId: panelId }
    }
    if (movedToMainIds.has(tab.id) && mainTargetId) {
      return { ...tab, groupId: mainTargetId }
    }
    return tab
  })
  for (const group of nextGroups) {
    nextTabs = applyTabOrderSortValues(nextTabs, group.tabOrder)
  }

  const nextState: AppState = {
    ...state,
    unifiedTabsByWorktree: { ...state.unifiedTabsByWorktree, [worktreeId]: nextTabs },
    groupsByWorktree: { ...state.groupsByWorktree, [worktreeId]: nextGroups },
    layoutByWorktree,
    activeGroupIdByWorktree
  }
  return {
    unifiedTabsByWorktree: nextState.unifiedTabsByWorktree,
    groupsByWorktree: nextState.groupsByWorktree,
    layoutByWorktree,
    activeGroupIdByWorktree,
    ...(state.activeWorktreeId === worktreeId
      ? buildActiveSurfacePatch(nextState, worktreeId, nextActiveGroupId)
      : {})
  }
}

type FocusedSessionState = Pick<
  AppState,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'activeGroupIdByWorktree' | 'layoutByWorktree'
>

/** The session the main area is showing: the focused main group's tab, or the first main group's. */
export function selectFocusedSessionTab(
  state: FocusedSessionState,
  worktreeId: string | null | undefined
): Tab | null {
  if (!worktreeId) {
    return null
  }
  const main = (state.groupsByWorktree[worktreeId] ?? []).filter(
    (group) => !isSidePanelGroupId(group.id)
  )
  const layout = state.layoutByWorktree[worktreeId]
  const layoutFirstId =
    layout && !layoutHasLeaf(layout, sidePanelGroupId(worktreeId))
      ? firstLeafGroupId(layout)
      : undefined
  const activeId = state.activeGroupIdByWorktree[worktreeId]
  const group =
    main.find((candidate) => candidate.id === activeId) ??
    main.find((candidate) => candidate.id === layoutFirstId) ??
    main[0]
  if (!group?.activeTabId) {
    return null
  }
  const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
    (candidate) => candidate.id === group.activeTabId
  )
  return tab && isSessionTab(tab) ? tab : null
}
