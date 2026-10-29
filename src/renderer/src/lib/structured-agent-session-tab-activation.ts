import { getRuntimeEnvironmentIdForWorktree } from './worktree-runtime-owner'
import { useAppStore } from '@/store'
import {
  callRuntimeRpc,
  getActiveRuntimeTarget,
  type RuntimeClientTarget
} from '@/runtime/runtime-rpc-client'
import {
  executionHostIdForStructuredTarget,
  structuredAgentSessionOwnerForTab
} from '@/runtime/structured-agent-session-owner'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type { Tab } from '../../../shared/tab-types'

export function findStructuredAgentSessionTab(
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[]>>,
  args: { workspaceId: string; sessionId: string; target?: RuntimeClientTarget }
): Tab | null {
  return (
    unifiedTabsByWorktree[args.workspaceId]?.find(
      (candidate) =>
        candidate.worktreeId === args.workspaceId &&
        candidate.contentType === 'agent-session' &&
        candidate.entityId === args.sessionId &&
        (!args.target ||
          structuredAgentSessionOwnerForTab(useAppStore.getState(), candidate) ===
            executionHostIdForStructuredTarget(args.target))
    ) ?? null
  )
}

/** The worktree whose tab inventory lists this chat; a child can live in a worktree other than its parent's. */
export function findStructuredAgentSessionWorktreeId(
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[]>>,
  sessionId: string
): string | null {
  for (const [worktreeId, tabs] of Object.entries(unifiedTabsByWorktree)) {
    if (tabs.some((tab) => tab.contentType === 'agent-session' && tab.entityId === sessionId)) {
      return worktreeId
    }
  }
  return null
}

export function activateStructuredAgentSessionTab(args: {
  worktreeId: string
  tabId: string
  target?: RuntimeClientTarget
}): boolean {
  const state = useAppStore.getState()
  const tab = (state.unifiedTabsByWorktree[args.worktreeId] ?? []).find(
    (candidate) =>
      candidate.id === args.tabId &&
      candidate.contentType === 'agent-session' &&
      (!args.target ||
        structuredAgentSessionOwnerForTab(state, candidate) ===
          executionHostIdForStructuredTarget(args.target))
  )
  if (!tab) {
    return false
  }
  state.focusGroup(args.worktreeId, tab.groupId)
  state.activateTab(tab.id, { worktreeId: args.worktreeId })
  state.setActiveTabType('agent-session', args.worktreeId)
  const environmentId = getRuntimeEnvironmentIdForWorktree(state, args.worktreeId)
  void callRuntimeRpc(
    args.target ?? getActiveRuntimeTarget({ activeRuntimeEnvironmentId: environmentId }),
    'session.tabs.activate',
    {
      worktree: toRuntimeWorktreeSelector(args.worktreeId),
      tabId: `agent-session:${tab.entityId}`
    }
  )
  return true
}

/** Whether the inventory holds the chat's tab, without showing it. */
export function structuredAgentSessionTabListed(args: {
  worktreeId: string
  sessionId: string
  target?: RuntimeClientTarget
}): boolean {
  return (
    findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, {
      workspaceId: args.worktreeId,
      sessionId: args.sessionId,
      target: args.target
    }) !== null
  )
}

export function activateStructuredAgentSessionById(args: {
  worktreeId: string
  sessionId: string
  target?: RuntimeClientTarget
}): boolean {
  const tab = findStructuredAgentSessionTab(useAppStore.getState().unifiedTabsByWorktree, {
    workspaceId: args.worktreeId,
    sessionId: args.sessionId,
    target: args.target
  })
  return tab
    ? activateStructuredAgentSessionTab({
        worktreeId: args.worktreeId,
        tabId: tab.id,
        target: args.target
      })
    : false
}
