import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { useAppStore } from '../../store'
import {
  findActivityTerminalPortal,
  type ActivityTerminalPortalTarget
} from '../activity/activity-terminal-portal'
import { shouldMountBackgroundWorktreeTab } from '../terminal/background-terminal-worktree-mount'
import { useNativeChatToggleShortcut } from '../native-chat/use-native-chat-toggle-shortcut'
import { RetainedPaneHost } from '../tab-group/RetainedPaneHost'
import {
  referencedPlacement,
  selectLayoutWorktreeId,
  selectReferencedSessions
} from '../../store/slices/tabs/pane-session-ref'
import { TerminalOverlaySlot } from './TerminalOverlaySlot'
import { captureWorkspaceEmptiedReaction } from '../tab-group/workspace-emptied-reaction'
import { TerminalRestoringPlaceholder } from './TerminalRestoringPlaceholder'
import { useTerminalTabColdParking } from './use-terminal-tab-cold-parking'

type TerminalOverlayAssignment = {
  unifiedTabId: string
  groupId: string
  isActiveInGroup: boolean
}

const EMPTY_TERMINAL_TABS: readonly TerminalTab[] = []
const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []
const EMPTY_ACTIVITY_PORTALS: ActivityTerminalPortalTarget[] = []

const TerminalPaneOverlayLayer = memo(function TerminalPaneOverlayLayer({
  worktreeId,
  worktreePath,
  isWorktreeActive,
  coldParkTerminalPanes = false,
  isForceParked = false,
  shouldMeasureHiddenWorktree = false,
  activityTerminalPortals = EMPTY_ACTIVITY_PORTALS,
  backgroundMountTabIds = null,
  activationDeferredMountTabIds = null,
  ownsNativeChatToggleShortcut = true
}: {
  worktreeId: string
  worktreePath: string
  isWorktreeActive: boolean
  coldParkTerminalPanes?: boolean
  /** Retention-budget force-park keeps eviction-exempt tabs mounted. */
  isForceParked?: boolean
  shouldMeasureHiddenWorktree?: boolean
  activityTerminalPortals?: ActivityTerminalPortalTarget[]
  /** Targeted mounts connect only these terminal tabs. */
  backgroundMountTabIds?: ReadonlySet<string> | null
  /** Cold-activation deferred tabs receive immediate parked watcher coverage. */
  activationDeferredMountTabIds?: ReadonlySet<string> | null
  /** False for overlay hosts whose workspace is visible while another owns global keyboard
   *  chords — the toggle listener is gated to one live workspace at a time. */
  ownsNativeChatToggleShortcut?: boolean
}): React.JSX.Element | null {
  const { terminalTabs, unifiedTabs, groups, activeGroupId } = useAppStore(
    useShallow((state) => ({
      terminalTabs: state.tabsByWorktree[worktreeId] ?? EMPTY_TERMINAL_TABS,
      unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
      groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
      activeGroupId: state.activeGroupIdByWorktree[worktreeId]
    }))
  )
  const focusGroup = useAppStore((state) => state.focusGroup)
  const referenced = useAppStore(selectReferencedSessions)
  const layoutWorktreeId = useAppStore(selectLayoutWorktreeId)
  const activeGroupIdByWorktree = useAppStore((state) => state.activeGroupIdByWorktree)
  const consumeSuppressedPtyExit = useAppStore((state) => state.consumeSuppressedPtyExit)

  useNativeChatToggleShortcut(worktreeId, isWorktreeActive && ownsNativeChatToggleShortcut)

  const captureEmptiedReaction = useCallback(
    () => captureWorkspaceEmptiedReaction(worktreeId),
    [worktreeId]
  )

  const focusOwningGroup = useCallback(
    (groupId: string) => {
      // Why: a pane that shows this workspace's session from another workspace's layout takes the focus there.
      const shownIn = [...referenced.values()].find((entry) => entry.groupId === groupId)
      focusGroup(shownIn?.layoutWorktreeId ?? worktreeId, groupId)
    },
    [focusGroup, referenced, worktreeId]
  )

  const groupActiveTabById = useMemo(() => {
    const lookup: Record<string, string | null | undefined> = {}
    for (const group of groups) {
      lookup[group.id] = group.activeTabId
    }
    return lookup
  }, [groups])

  const assignments = useMemo(() => {
    const entries = new Map<string, TerminalOverlayAssignment>()
    for (const tab of unifiedTabs) {
      if (tab.contentType !== 'terminal') {
        continue
      }
      entries.set(tab.entityId, {
        unifiedTabId: tab.id,
        groupId: tab.groupId,
        isActiveInGroup: groupActiveTabById[tab.groupId] === tab.id
      })
    }
    return entries
  }, [groupActiveTabById, unifiedTabs])

  const activeTerminalTabId = useMemo(() => {
    if (!activeGroupId) {
      return null
    }
    for (const [terminalTabId, assignment] of assignments) {
      if (assignment.groupId === activeGroupId && assignment.isActiveInGroup) {
        return terminalTabId
      }
    }
    return null
  }, [activeGroupId, assignments])

  const parkedTerminalTabIds = useTerminalTabColdParking({
    worktreeId,
    terminalTabs,
    assignments,
    isWorktreeActive,
    activeTerminalTabId,
    coldParkTerminalPanes,
    isForceParked,
    shouldMeasureHiddenWorktree,
    activityTerminalPortals,
    activationDeferredMountTabIds
  })

  if (!worktreePath) {
    return null
  }

  return (
    <>
      {terminalTabs.map((terminalTab) => {
        const assignment = assignments.get(terminalTab.id)
        // Why: a session some pane shows by reference is placed by that pane, and only while its layout is on screen.
        const shown = assignment
          ? referencedPlacement(
              referenced,
              assignment.unifiedTabId,
              layoutWorktreeId,
              activeGroupIdByWorktree
            )
          : null
        const isVisible = shown
          ? shown.isVisible
          : Boolean(isWorktreeActive && assignment?.isActiveInGroup)
        if (
          !shown?.isVisible &&
          !shouldMountBackgroundWorktreeTab(backgroundMountTabIds, terminalTab.id)
        ) {
          // Why only the startup hold lands here visible: reveal admits every other visible
          // deferred tab in the same render pass.
          return isVisible ? (
            <RetainedPaneHost
              key={terminalTab.id}
              groupId={shown ? shown.groupId : assignment?.groupId}
              isVisible
              onFocusOwningGroup={focusOwningGroup}
            >
              <TerminalRestoringPlaceholder />
            </RetainedPaneHost>
          ) : null
        }
        const isActive = shown
          ? shown.isFocusedGroup
          : Boolean(isVisible && assignment?.groupId === activeGroupId)
        const activityTerminalPortal = findActivityTerminalPortal(activityTerminalPortals, {
          worktreeId,
          tabId: terminalTab.id
        })
        // Why: a shown reference is exempt from parking, or its pane would stay blank while the workspace that owns it is hidden.
        if (parkedTerminalTabIds.has(terminalTab.id) && !shown?.isVisible) {
          return null
        }
        return (
          <TerminalOverlaySlot
            key={terminalTab.id}
            terminalTabId={terminalTab.id}
            terminalGeneration={terminalTab.generation}
            worktreeId={worktreeId}
            worktreePath={worktreePath}
            startupCwd={terminalTab.startupCwd}
            groupId={shown ? shown.groupId : assignment?.groupId}
            isWorktreeActive={isWorktreeActive || Boolean(shown?.isVisible)}
            isVisible={isVisible}
            isActive={isActive}
            activityTerminalPortal={activityTerminalPortal}
            portalWorktreeId={
              shown?.isVisible && shown.focusWorktreeId !== worktreeId
                ? shown.focusWorktreeId
                : null
            }
            onFocusOwningGroup={focusOwningGroup}
            consumeSuppressedPtyExit={consumeSuppressedPtyExit}
            captureEmptiedReaction={captureEmptiedReaction}
          />
        )
      })}
    </>
  )
})

export default TerminalPaneOverlayLayer
