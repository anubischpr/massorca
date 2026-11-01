import type { AppState } from '../../types'
import type { TabGroup } from '../../../../../shared/tab-types'
import { sidePanelGroupId } from './side-panel-group'
import type { TabsSlice, TabsSliceSet } from './tabs-slice-contract'
import { buildActiveSurfacePatch } from './tabs-surface'

export const DEFAULT_SIDE_PANEL_WIDTH = 380
export const MIN_SIDE_PANEL_WIDTH = 280
export const MAX_SIDE_PANEL_WIDTH = 720

const EMPTY_TAB_IDS: readonly string[] = []

type SidePanelSelectorState = Pick<AppState, 'groupsByWorktree' | 'sidePanelOpenByWorktree'>

/** Ordered ids of the tabs the workspace's side panel holds. */
export function selectSidePanelTabIds(
  state: Pick<AppState, 'groupsByWorktree'>,
  worktreeId: string
): readonly string[] {
  const panelId = sidePanelGroupId(worktreeId)
  return (
    state.groupsByWorktree[worktreeId]?.find((group) => group.id === panelId)?.tabOrder ??
    EMPTY_TAB_IDS
  )
}

/** An explicit choice wins; otherwise the panel shows exactly when it has tabs to show. */
export function selectSidePanelOpen(state: SidePanelSelectorState, worktreeId: string): boolean {
  return (
    state.sidePanelOpenByWorktree[worktreeId] ?? selectSidePanelTabIds(state, worktreeId).length > 0
  )
}

/** The workspace's groups with an (empty) panel group present, so a tab-less workspace can still mount the panel. */
function withPanelGroup(groups: readonly TabGroup[], worktreeId: string): TabGroup[] {
  const panelId = sidePanelGroupId(worktreeId)
  return groups.some((group) => group.id === panelId)
    ? [...groups]
    : [...groups, { id: panelId, worktreeId, activeTabId: null, tabOrder: [], recentTabIds: [] }]
}

function openedPanelGroups(
  state: Pick<AppState, 'groupsByWorktree'>,
  worktreeId: string
): Pick<AppState, 'groupsByWorktree'> {
  return {
    groupsByWorktree: {
      ...state.groupsByWorktree,
      [worktreeId]: withPanelGroup(state.groupsByWorktree[worktreeId] ?? [], worktreeId)
    }
  }
}

export function createSidePanelActions(
  set: TabsSliceSet
): Pick<
  TabsSlice,
  'setSidePanelOpen' | 'toggleSidePanel' | 'setSidePanelWidth' | 'focusSidePanel'
> {
  return {
    focusSidePanel: (worktreeId) => {
      const panelId = sidePanelGroupId(worktreeId)
      set((state) => {
        const nextGroups = withPanelGroup(state.groupsByWorktree[worktreeId] ?? [], worktreeId)
        const next = {
          groupsByWorktree: { ...state.groupsByWorktree, [worktreeId]: nextGroups },
          activeGroupIdByWorktree: { ...state.activeGroupIdByWorktree, [worktreeId]: panelId },
          sidePanelOpenByWorktree: { ...state.sidePanelOpenByWorktree, [worktreeId]: true }
        }
        return {
          ...next,
          ...(state.activeWorktreeId === worktreeId
            ? buildActiveSurfacePatch({ ...state, ...next }, worktreeId, panelId)
            : {})
        }
      })
      return panelId
    },
    setSidePanelOpen: (worktreeId, open) =>
      set((state) =>
        state.sidePanelOpenByWorktree[worktreeId] === open
          ? state
          : {
              sidePanelOpenByWorktree: { ...state.sidePanelOpenByWorktree, [worktreeId]: open },
              ...(open ? openedPanelGroups(state, worktreeId) : {})
            }
      ),
    toggleSidePanel: (worktreeId) =>
      set((state) => {
        const open = !selectSidePanelOpen(state, worktreeId)
        return {
          sidePanelOpenByWorktree: { ...state.sidePanelOpenByWorktree, [worktreeId]: open },
          ...(open ? openedPanelGroups(state, worktreeId) : {})
        }
      }),
    setSidePanelWidth: (width) =>
      set((state) => {
        const next = Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width))
        return next === state.sidePanelWidth ? state : { sidePanelWidth: next }
      })
  }
}
