import type { TabGroupSessionRef } from '../../../../../shared/tab-types'
import type { TabsSlice, TabsSliceGet, TabsSliceSet } from './tabs-slice-contract'
import { resolveSessionRefTab, selectReferencedSessions } from './pane-session-ref'
import { isSidePanelGroupId } from './side-panel-group'

export function createTabsSessionRefActions(
  set: TabsSliceSet,
  get: TabsSliceGet
): Pick<TabsSlice, 'showSessionInPane' | 'clearPaneSessionRef'> {
  return {
    showSessionInPane: (worktreeId, groupId, ref: TabGroupSessionRef) => {
      const state = get()
      const group = (state.groupsByWorktree[worktreeId] ?? []).find(
        (candidate) => candidate.id === groupId
      )
      // Why: a pane is either empty or shows one session; the session stays where it runs, so a
      // reference to this workspace's own session is an ordinary tab.
      if (
        !group ||
        isSidePanelGroupId(groupId) ||
        group.tabOrder.length > 0 ||
        ref.worktreeId === worktreeId ||
        !resolveSessionRefTab(state, ref) ||
        selectReferencedSessions(state).has(ref.tabId)
      ) {
        return false
      }
      set((current) => ({
        groupsByWorktree: {
          ...current.groupsByWorktree,
          [worktreeId]: (current.groupsByWorktree[worktreeId] ?? []).map((candidate) =>
            candidate.id === groupId ? { ...candidate, sessionRef: ref } : candidate
          )
        }
      }))
      return true
    },

    clearPaneSessionRef: (worktreeId, groupId) => {
      set((current) => ({
        groupsByWorktree: {
          ...current.groupsByWorktree,
          [worktreeId]: (current.groupsByWorktree[worktreeId] ?? []).map((candidate) => {
            if (candidate.id !== groupId || !candidate.sessionRef) {
              return candidate
            }
            const { sessionRef: _dropped, ...rest } = candidate
            return rest
          })
        }
      }))
    }
  }
}
