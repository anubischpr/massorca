import { useCallback } from 'react'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { dismissStaleAgentRowByKey } from '../terminal-pane/stale-agent-row'

/**
 * Focuses an agent row's pane in the worktree that holds it, or drops the row when its pane is gone.
 * A child session in another worktree is focused there, not in the card that lists it.
 */
export function activateAgentTabInWorktree(
  worktreeId: string,
  tabId: string,
  paneKey: string
): void {
  const parsed = parsePaneKey(paneKey)
  if (!parsed) {
    // Why: malformed/legacy numeric keys can't be resolved after pane replay/remount, so drop the stale row instead of guessing.
    console.warn('[WorktreeCardAgents] malformed paneKey, skipping pane focus', paneKey)
    dismissStaleAgentRowByKey(paneKey)
    return
  }
  if (parsed.tabId !== tabId) {
    console.warn('[WorktreeCardAgents] paneKey tabId mismatch, dismissing row', {
      tabId,
      paneKey
    })
    dismissStaleAgentRowByKey(paneKey)
    return
  }
  // Why: design-doc rule — every user-initiated worktree switch must route through activateAndRevealWorktree (cross-repo activation + nav history).
  activateAndRevealWorktree(worktreeId)
  const tabs = useAppStore.getState().tabsByWorktree[worktreeId] ?? []
  if (tabs.some((t) => t.id === tabId)) {
    activateTabAndFocusPane(tabId, parsed.leafId, {
      ackPaneKeyOnSuccess: paneKey,
      flashFocusedPane: true,
      scrollToBottomIfOutputSinceLastView: true
    })
  } else if (!activateStructuredAgentSessionTab({ worktreeId, tabId })) {
    const liveEntry = useAppStore.getState().agentStatusByPaneKey[paneKey]
    if (liveEntry?.worktreeId === worktreeId) {
      // Why: orchestration worker status can be worktree-attributed before the renderer knows its tab; keep the live row instead of dismissing as stale.
      return
    }
    dismissStaleAgentRowByKey(paneKey)
  }
}

/** Focuses an agent row's pane, or drops the row when its pane is gone. Shared by every row layout. */
export function useActivateAgentTab(worktreeId: string): (tabId: string, paneKey: string) => void {
  return useCallback(
    (tabId: string, paneKey: string) => activateAgentTabInWorktree(worktreeId, tabId, paneKey),
    [worktreeId]
  )
}

/** Like useActivateAgentTab, but a row that names its worktree (a child session elsewhere) focuses there. */
export function useActivateAgentRowInOwner(
  worktreeId: string
): (tabId: string, paneKey: string, ownerWorktreeId?: string) => void {
  return useCallback(
    (tabId: string, paneKey: string, ownerWorktreeId?: string) =>
      activateAgentTabInWorktree(ownerWorktreeId ?? worktreeId, tabId, paneKey),
    [worktreeId]
  )
}
