import { useMemo } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import { mobileDelegatedChildAccess } from './mobile-delegated-child-access'
import type { MobileSessionTab } from './mobile-session-route-types'
import { locateStructuredChild } from './mobile-worktree-agent-rows'
import { useOpenMobileSession } from './use-open-mobile-session'
import { useWorktreeAgentRows } from './use-worktree-agent-rows'

/** Delegated children this session's chat can open: a tab here, or a pane the host lists elsewhere. */
export function useMobileSessionDelegatedChildren(args: {
  client: RpcClient | null
  hostId: string
  sessionRows: readonly { tab: MobileSessionTab }[]
  switchSessionTab: (tab: MobileSessionTab) => void
}) {
  const { client, hostId, sessionRows, switchSessionTab } = args
  const { worktrees, refresh } = useWorktreeAgentRows(client)
  const openMobileSession = useOpenMobileSession()
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
  return { delegatedChildren }
}
