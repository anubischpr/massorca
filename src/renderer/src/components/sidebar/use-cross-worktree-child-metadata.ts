import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { useAppStore } from '@/store'
import { selectChildWorktreeBranchNames } from './worktree-child-placement'
import { selectHostDisconnectedByWorktreeId } from './worktree-host-reachability'

/**
 * The host state and branch of each other worktree whose child session a card lists under its own
 * parent. Each record is keyed by worktree id and holds primitives, so the card re-renders only when
 * one of them changes.
 */
export function useCrossWorktreeChildMetadata(agents: readonly DashboardAgentRow[]): {
  hostDisconnectedByWorktreeId: Readonly<Record<string, boolean>>
  branchByWorktreeId: Readonly<Record<string, string>>
} {
  const worktreeIds = useMemo(
    () => [
      ...new Set(agents.flatMap((agent) => (agent.crossWorktree ? [agent.tab.worktreeId] : [])))
    ],
    [agents]
  )
  const hostDisconnectedByWorktreeId = useAppStore(
    useShallow((s) => selectHostDisconnectedByWorktreeId(s, worktreeIds))
  )
  const branchByWorktreeId = useAppStore(
    useShallow((s) => selectChildWorktreeBranchNames(s, worktreeIds))
  )
  return { hostDisconnectedByWorktreeId, branchByWorktreeId }
}
