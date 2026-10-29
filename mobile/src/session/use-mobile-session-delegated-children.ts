import { useEffect, useMemo } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import { mobileDelegatedChildAccess } from './mobile-delegated-child-access'
import type { MobileSessionTab } from './mobile-session-route-types'
import { mobileSessionChildParentTabIds } from './mobile-session-tab-lineage'
import { locateStructuredChild } from './mobile-worktree-agent-rows'
import { useOpenMobileSession } from './use-open-mobile-session'
import { useWorktreeAgentRows } from './use-worktree-agent-rows'

/** Delegated children this session's chat can open (a tab here, or a pane the host lists elsewhere),
 *  and where each child tab nests in the sessions sheet. */
export function useMobileSessionDelegatedChildren(args: {
  client: RpcClient | null
  hostId: string
  worktreeId: string
  sessionRows: readonly { tab: MobileSessionTab }[]
  sessionsSheetOpen: boolean
  switchSessionTab: (tab: MobileSessionTab) => void
}) {
  const { client, hostId, worktreeId, sessionRows, sessionsSheetOpen, switchSessionTab } = args
  const { worktrees, refresh } = useWorktreeAgentRows(client)
  const openMobileSession = useOpenMobileSession()
  // Why: a child or pane started since the last read shows up when the sheet opens, not only on mount.
  useEffect(() => {
    if (sessionsSheetOpen) {
      refresh()
    }
  }, [refresh, sessionsSheetOpen])
  const childParentTabIds = useMemo(
    () =>
      mobileSessionChildParentTabIds(
        sessionRows.map((row) => row.tab),
        worktrees.find((worktree) => worktree.worktreeId === worktreeId)?.agents ?? []
      ),
    [sessionRows, worktreeId, worktrees]
  )
  const delegatedChildren = useMemo(
    () =>
      mobileDelegatedChildAccess(() => sessionRows.map((row) => row.tab), switchSessionTab, {
        locate: (childSessionId) => locateStructuredChild(childSessionId, worktrees),
        open: (location) =>
          openMobileSession({
            hostId,
            worktreeId: location.worktreeId,
            paneKey: location.paneKey
          }),
        refresh
      }),
    [hostId, openMobileSession, refresh, sessionRows, switchSessionTab, worktrees]
  )
  return { delegatedChildren, childParentTabIds }
}
