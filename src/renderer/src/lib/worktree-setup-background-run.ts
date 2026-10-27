import { useAppStore } from '@/store'
import { singlePaneLayoutSnapshot } from '@/store/slices/terminal-helpers'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { getSettingsForWorktreeRuntimeOwner } from '@/lib/worktree-runtime-owner'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { buildSetupCommand, getSetupTabTitle } from '@/lib/launch-worktree-background-terminals'
import { worktreeSetupPtyIdFromTaskId } from '../../../shared/worktree-setup-row'
import type {
  WorktreeDefaultTabsLaunch,
  WorktreeSetupLaunch
} from '../../../shared/worktree/launch-types'
import type { Worktree } from '../../../shared/worktree/types'

/**
 * Starts a create-chat worktree's setup script in a real PTY on the workspace's host, with no tab.
 * Main keeps the PTY alive across a reload and the chat roster shows it. Returns the PTY id, or
 * null when the runtime owns setup itself.
 */
export async function launchWorktreeSetupBackgroundRun(args: {
  worktree: Worktree
  setup: WorktreeSetupLaunch
}): Promise<string | null> {
  const store = useAppStore.getState()
  const runtimeTarget = getActiveRuntimeTarget(
    getSettingsForWorktreeRuntimeOwner(store, args.worktree.id)
  )
  if (runtimeTarget.kind === 'environment') {
    return null
  }
  const repo = store.repos.find((entry) => entry.id === args.worktree.repoId)
  const result = await window.api.pty.spawn({
    cols: 120,
    rows: 40,
    cwd: args.worktree.path,
    command: buildSetupCommand(args.setup),
    env: { ...args.setup.envVars, ORCA_WORKTREE_ID: args.worktree.id },
    connectionId: repo?.connectionId ?? null,
    worktreeId: args.worktree.id
  })
  try {
    await window.api.worktreeSetupRuns.register({
      ptyId: result.id,
      worktreeId: args.worktree.id
    })
  } catch (error) {
    // Why: an unregistered setup PTY would be swept on the next reload with no row to stop it.
    await window.api.pty.kill(result.id)
    throw error
  }
  return result.id
}

/**
 * Starts a create-chat worktree's setup hidden and returns the part that stays visible: none. Any
 * other create keeps its setup as the visible terminal it always was.
 */
export function routeCreateTerminals(args: {
  presentation: 'chat-background-task' | undefined
  worktree: Worktree
  setup: WorktreeSetupLaunch | undefined
  defaultTabs: WorktreeDefaultTabsLaunch | undefined
}): { setup: WorktreeSetupLaunch | undefined; defaultTabs: WorktreeDefaultTabsLaunch | undefined } {
  if (args.presentation !== 'chat-background-task') {
    return { setup: args.setup, defaultTabs: args.defaultTabs }
  }
  if (args.setup) {
    launchWorktreeSetupBackgroundRun({ worktree: args.worktree, setup: args.setup }).catch(
      (error: unknown) => {
        console.error('worktree create: hidden setup run failed', args.worktree.id, error)
      }
    )
  }
  // Why: a chat-first create opens the chat alone; the repo's default tabs are not created.
  return { setup: undefined, defaultTabs: undefined }
}

/**
 * Promotes a hidden setup run into the tab strip and activates it. A second reveal of the same
 * PTY selects the tab it already made instead of adding another.
 */
export function revealWorktreeSetupRun(args: { worktreeId: string; ptyId: string }): boolean {
  const revealed = activateAndRevealWorkspace(args.worktreeId, { providesInitialSurface: true })
  if (revealed === false) {
    return false
  }
  const store = useAppStore.getState()
  const existing = (store.tabsByWorktree[args.worktreeId] ?? []).find(
    (tab) => tab.ptyId === args.ptyId
  )
  if (existing) {
    store.setActiveTab(existing.id)
    return true
  }
  const tab = store.createTab(args.worktreeId, undefined, undefined, { activate: true })
  store.setTabCustomTitle(tab.id, getSetupTabTitle(), { recordInteraction: false })
  const leafId = createBrowserUuid()
  store.setTabLayout(tab.id, singlePaneLayoutSnapshot(leafId, args.ptyId))
  store.updateTabPtyId(tab.id, args.ptyId)
  return true
}

/** "Show output" on a setup row: main names the workspace the run belongs to, then it is revealed. */
export async function revealWorktreeSetupOutput(taskId: string): Promise<boolean> {
  const ptyId = worktreeSetupPtyIdFromTaskId(taskId)
  if (ptyId === null) {
    return false
  }
  const { worktreeId } = await window.api.worktreeSetupRuns.worktreeIdFor({ ptyId })
  return worktreeId !== null && revealWorktreeSetupRun({ worktreeId, ptyId })
}
