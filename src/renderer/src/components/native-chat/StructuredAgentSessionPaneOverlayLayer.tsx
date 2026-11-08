import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import { useAppStore } from '@/store'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import { createPortal } from 'react-dom'
import { RetainedPaneHost } from '../tab-group/RetainedPaneHost'
import { useLayoutOverlayRoot } from '../tab-group/layout-overlay-root'
import {
  referencedPlacement,
  selectLayoutWorktreeId,
  selectReferencedSessions
} from '../../store/slices/tabs/pane-session-ref'
import NativeChatView from './NativeChatView'
import { isStructuredTab } from './structured-agent-session-tabs'

type StructuredAgentSessionTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

const StructuredAgentSessionOverlaySlot = memo(function StructuredAgentSessionOverlaySlot({
  tab,
  groupId,
  isActive,
  isFocusedGroup,
  portalWorktreeId,
  onFocusOwningGroup
}: {
  tab: StructuredAgentSessionTab
  groupId: string | undefined
  isActive: boolean
  isFocusedGroup: boolean
  /** The layout that shows this session by reference from another workspace, when it does. */
  portalWorktreeId: string | null
  onFocusOwningGroup: ((groupId: string) => void) | undefined
}): React.JSX.Element | null {
  const portalRoot = useLayoutOverlayRoot(portalWorktreeId)
  // Each chat is read from the host recorded on its tab, never from its workspace id, which two
  // hosts can share.
  const owner = useAppStore((state) => structuredAgentSessionOwnerForTab(state, tab))
  const target = useMemo(() => structuredAgentSessionTargetForHost(owner), [owner])
  if (!target) {
    return null
  }
  const host = (
    <RetainedPaneHost
      groupId={groupId}
      isVisible={isActive}
      data-structured-agent-session-overlay-tab-id={tab.id}
      onFocusOwningGroup={onFocusOwningGroup}
    >
      <NativeChatView
        mode="structured"
        tabId={tab.id}
        groupId={groupId}
        sessionId={tab.entityId}
        agent={tab.agentSessionAgent}
        isVisible={isActive}
        isFocusedGroup={isFocusedGroup}
        target={target}
      />
    </RetainedPaneHost>
  )
  return portalRoot ? createPortal(host, portalRoot) : host
})

const StructuredAgentSessionPaneOverlayLayer = memo(
  function StructuredAgentSessionPaneOverlayLayer({
    worktreeId,
    isWorktreeActive
  }: {
    worktreeId: string
    isWorktreeActive: boolean
  }): React.JSX.Element {
    const { unifiedTabs, groups, activeGroupId } = useAppStore(
      useShallow((state) => ({
        unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
        groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
        activeGroupId: state.activeGroupIdByWorktree[worktreeId]
      }))
    )
    const focusGroup = useAppStore((state) => state.focusGroup)
    const referenced = useAppStore(selectReferencedSessions)
    const layoutWorktreeId = useAppStore(selectLayoutWorktreeId)
    const activeGroupIdByWorktree = useAppStore((state) => state.activeGroupIdByWorktree)
    const isFloatingPanelOpen = useAppStore((state) => state.floatingWorkspacePanelOpen)
    const focusOwningGroup = useCallback(
      (groupId: string) => {
        // Why: a pane that shows this workspace's session from another workspace's layout takes the focus there.
        const shownIn = [...referenced.values()].find((entry) => entry.groupId === groupId)
        focusGroup(shownIn?.layoutWorktreeId ?? worktreeId, groupId)
      },
      [focusGroup, referenced, worktreeId]
    )
    const groupActiveTabById = useMemo(
      () => new Map(groups.map((group) => [group.id, group.activeTabId] as const)),
      [groups]
    )
    const structuredTabs = useMemo(
      () => unifiedTabs.filter((tab): tab is StructuredAgentSessionTab => isStructuredTab(tab)),
      [unifiedTabs]
    )

    return (
      <>
        {structuredTabs.map((tab) => {
          const shown = referencedPlacement(
            referenced,
            tab.id,
            layoutWorktreeId,
            activeGroupIdByWorktree,
            isFloatingPanelOpen
          )
          return (
            <StructuredAgentSessionOverlaySlot
              key={tab.id}
              tab={tab}
              groupId={shown ? shown.groupId : tab.groupId}
              isActive={
                shown
                  ? shown.isVisible
                  : Boolean(isWorktreeActive && groupActiveTabById.get(tab.groupId) === tab.id)
              }
              isFocusedGroup={
                shown
                  ? shown.isFocusedGroup
                  : Boolean(
                      isWorktreeActive &&
                      groupActiveTabById.get(tab.groupId) === tab.id &&
                      tab.groupId === activeGroupId
                    )
              }
              portalWorktreeId={
                shown?.isVisible && shown.focusWorktreeId !== worktreeId
                  ? shown.focusWorktreeId
                  : null
              }
              onFocusOwningGroup={focusOwningGroup}
            />
          )
        })}
      </>
    )
  }
)

export default StructuredAgentSessionPaneOverlayLayer
