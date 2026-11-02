import type { Tab, TabGroup, TabGroupSessionRef } from '../../../../../shared/tab-types'
import type { AppState } from '../../types'
import { isSessionTab, isSidePanelGroupId } from './side-panel-group'

type RefState = Pick<AppState, 'groupsByWorktree' | 'unifiedTabsByWorktree'>

/** A session shown by reference: which workspace owns it, and which pane of which layout shows it. */
export type ReferencedSession = {
  tabId: string
  ownerWorktreeId: string
  layoutWorktreeId: string
  groupId: string
}

/** The live session tab a reference names, or null once it, or its workspace, is gone. */
export function resolveSessionRefTab(
  state: Pick<AppState, 'unifiedTabsByWorktree'>,
  ref: TabGroupSessionRef
): Tab | null {
  const tab = (state.unifiedTabsByWorktree[ref.worktreeId] ?? []).find(
    (candidate) => candidate.id === ref.tabId
  )
  return tab && isSessionTab(tab) ? tab : null
}

let cachedGroups: AppState['groupsByWorktree'] | null = null
let cachedTabs: AppState['unifiedTabsByWorktree'] | null = null
let cachedResult: ReadonlyMap<string, ReferencedSession> = new Map()

/** Every session some pane shows by reference, keyed by its tab id. One selector that consumers read. */
export function selectReferencedSessions(state: RefState): ReadonlyMap<string, ReferencedSession> {
  if (cachedGroups === state.groupsByWorktree && cachedTabs === state.unifiedTabsByWorktree) {
    return cachedResult
  }
  const referenced = new Map<string, ReferencedSession>()
  for (const [layoutWorktreeId, groups] of Object.entries(state.groupsByWorktree)) {
    for (const group of groups) {
      if (!group.sessionRef || isSidePanelGroupId(group.id)) {
        continue
      }
      if (
        !resolveSessionRefTab(state, group.sessionRef) ||
        referenced.has(group.sessionRef.tabId)
      ) {
        continue
      }
      referenced.set(group.sessionRef.tabId, {
        tabId: group.sessionRef.tabId,
        ownerWorktreeId: group.sessionRef.worktreeId,
        layoutWorktreeId,
        groupId: group.id
      })
    }
  }
  cachedGroups = state.groupsByWorktree
  cachedTabs = state.unifiedTabsByWorktree
  cachedResult = referenced
  return referenced
}

/**
 * Housekeeping, so nothing keeps pointing at what is gone: a reference whose session or workspace
 * no longer exists is cleared, as is one on a pane that now holds a session of its own. The pane
 * itself stays, empty and ready for the picker.
 */
export function planSessionRefCleanup(state: RefState): Partial<AppState> | null {
  let groupsByWorktree: AppState['groupsByWorktree'] | null = null
  for (const [worktreeId, groups] of Object.entries(state.groupsByWorktree)) {
    const next: TabGroup[] = groups.map((group) => {
      if (!group.sessionRef) {
        return group
      }
      if (group.tabOrder.length === 0 && resolveSessionRefTab(state, group.sessionRef)) {
        return group
      }
      const { sessionRef: _dropped, ...rest } = group
      return rest
    })
    if (next.some((group, index) => group !== groups[index])) {
      groupsByWorktree = { ...(groupsByWorktree ?? state.groupsByWorktree), [worktreeId]: next }
    }
  }
  return groupsByWorktree ? { groupsByWorktree } : null
}

/** True while a pane of this workspace's layout shows a live session of another workspace. */
export function hasLiveReferencePane(state: RefState, layoutWorktreeId: string): boolean {
  return (state.groupsByWorktree[layoutWorktreeId] ?? []).some(
    (group) =>
      group.sessionRef !== undefined &&
      group.tabOrder.length === 0 &&
      resolveSessionRefTab(state, group.sessionRef) !== null
  )
}

/** The workspace whose layout is on screen; differs from `activeWorktreeId` while a referenced pane has focus. */
export function selectLayoutWorktreeId(
  state: Pick<AppState, 'paneFocus' | 'activeWorktreeId'>
): string | null {
  const focus = state.paneFocus
  return focus && state.activeWorktreeId === focus.ownerWorktreeId
    ? focus.layoutWorktreeId
    : state.activeWorktreeId
}

/**
 * Whose side panel the layout of `layoutWorktreeId` shows: the session owner's while a referenced
 * pane has focus. The owner's own hidden layout then shows none, so one panel is on screen.
 */
export function selectSidePanelWorktreeId(
  state: Pick<AppState, 'paneFocus' | 'activeWorktreeId'>,
  layoutWorktreeId: string
): string | null {
  const focus = state.paneFocus
  if (!focus || state.activeWorktreeId !== focus.ownerWorktreeId) {
    return layoutWorktreeId
  }
  if (layoutWorktreeId === focus.layoutWorktreeId) {
    return focus.ownerWorktreeId
  }
  return layoutWorktreeId === focus.ownerWorktreeId ? null : layoutWorktreeId
}

export type ReferencedPlacement = {
  /** The pane the session's overlay anchors to, in the layout that shows it. */
  groupId: string
  isVisible: boolean
  isFocusedGroup: boolean
  /** The workspace whose layout owns that pane; focus goes there. */
  focusWorktreeId: string
}

/**
 * Where an overlay places a session that a pane shows by reference. It is visible only while the
 * layout that shows it is on screen, which is what keeps one live copy: its own workspace's
 * layout, when on screen, shows the picker in its place instead.
 */
export function referencedPlacement(
  referenced: ReadonlyMap<string, ReferencedSession>,
  tabId: string,
  layoutWorktreeId: string | null,
  activeGroupIdByWorktree: Readonly<Record<string, string | undefined>>
): ReferencedPlacement | null {
  const shown = referenced.get(tabId)
  if (!shown) {
    return null
  }
  const isVisible = shown.layoutWorktreeId === layoutWorktreeId
  return {
    groupId: shown.groupId,
    isVisible,
    isFocusedGroup: isVisible && activeGroupIdByWorktree[shown.layoutWorktreeId] === shown.groupId,
    focusWorktreeId: shown.layoutWorktreeId
  }
}
