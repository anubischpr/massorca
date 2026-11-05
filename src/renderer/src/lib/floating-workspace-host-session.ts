import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  FLOATING_HOST_NO_WORKSPACE_REASON,
  FLOATING_HOST_THIS_COMPUTER
} from './floating-workspace-host'
import type { TuiAgent } from '../../../shared/tui-agent'
import { newAgentLaunchRequestId } from './agent-launch-request-id'
import { useFloatingWorkspaceHostStore } from './floating-workspace-host-store'
import { launchAgentInNewTab } from './launch-agent-in-new-tab'
import { createWebRuntimeSessionTerminal } from '../runtime/web-runtime-terminal-creation'
import { focusTerminalTabSurface } from './focus-terminal-tab-surface'
import {
  awaitNewSessionTab,
  showSessionInFloatingWorkspace
} from './show-session-in-floating-workspace'

/** Shows a session that runs on a paired host in the floating workspace; a refusal is said out loud. */
export function showHostSessionInFloating(
  worktreeId: string,
  tabId: string,
  options: { endsSessionOnClose?: boolean } = {}
): boolean {
  const shown = showSessionInFloatingWorkspace({ worktreeId, tabId }, useAppStore, options)
  if (!shown.ok) {
    toast.error(
      translate(
        'components.floatingWorkspace.couldNotShow',
        'Could not show this session in the floating workspace.'
      )
    )
    return false
  }
  focusTerminalTabSurface(tabId)
  return true
}

// Why: a host-published launch opens its session after the host answers; past this it is not shown.
const HOST_SESSION_WAIT_MS = 30_000

/** Starts the agent in a paired host's workspace, then shows that session in the floating workspace. */
export function launchAgentOnHostWorkspace(
  agent: TuiAgent,
  agentLabel: string,
  worktreeId: string,
  environmentId: string
): void {
  const knownTabIds = knownSessionTabIds(worktreeId)
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent,
    worktreeId,
    launchSource: 'shortcut',
    activate: false
  })
  if (!result) {
    toast.error(
      translate(
        'auto.components.floating.terminal.FloatingTerminalWindowControls.82da3701e7',
        'Could not build launch command for {{value0}}.',
        { value0: agentLabel }
      )
    )
    return
  }
  useFloatingWorkspaceHostStore.getState().markUsed(environmentId)
  if (result.surface.kind === 'local-terminal') {
    showHostSessionInFloating(worktreeId, result.surface.tabId)
    return
  }
  showWhenHostPublishes(worktreeId, knownTabIds)
}

/** The workspace's tab ids before a launch, so the launch's own tab can be told apart. */
export function knownSessionTabIds(worktreeId: string): Set<string> {
  return new Set(
    (useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? []).map((tab) => tab.id)
  )
}

/** Shows the host's new session once its own tab id arrives; a provisional local id would be replaced. */
export function showWhenHostPublishes(
  worktreeId: string,
  knownTabIds: ReadonlySet<string>,
  options: { endsSessionOnClose?: boolean } = {}
): void {
  void awaitNewSessionTab(
    { worktreeId, knownTabIds, timeoutMs: HOST_SESSION_WAIT_MS },
    useAppStore
  ).then((tabId) => {
    if (tabId) {
      markAgentTerminalAsSession(worktreeId, tabId)
      showHostSessionInFloating(worktreeId, tabId, options)
      return
    }
    toast.error(
      translate(
        'components.floatingWorkspace.sessionNotReady',
        'The new session did not show up on that host.'
      )
    )
  })
}

/** A terminal fallback carries no view mode until stamped; without one it cannot be shown by reference. */
function markAgentTerminalAsSession(worktreeId: string, tabId: string): void {
  const state = useAppStore.getState()
  const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find((entry) => entry.id === tabId)
  if (tab?.contentType === 'terminal' && tab.viewMode === undefined) {
    state.setTabViewMode(tabId, 'terminal')
  }
}

/**
 * Starts a terminal in a paired host's workspace, then shows it in the floating workspace.
 * Why the host creates it: a locally created tab is replaced by the host's mirror under another id,
 * and the floating reference to it would close as dead.
 */
export async function startTerminalOnHostWorkspace(
  worktreeId: string,
  environmentId: string
): Promise<void> {
  const knownTabIds = knownSessionTabIds(worktreeId)
  const outcome = await createWebRuntimeSessionTerminal({
    worktreeId,
    environmentId,
    activate: false,
    selectWorktree: false,
    viewMode: 'terminal'
  })
  if (outcome.status === 'failed') {
    toast.error(outcome.message)
    return
  }
  useFloatingWorkspaceHostStore.getState().markUsed(environmentId)
  // Why: a terminal opened from the floating panel belongs to it; left behind on close, it would
  // pile up in the host workspace.
  showWhenHostPublishes(worktreeId, knownTabIds, { endsSessionOnClose: true })
}

/** The "+" menu's host while a paired host is selected: it lists that host's agents and shells, and starts agents there. */
export function floatingCreateHost(
  selectedHost: string,
  remoteWorkspaceId: string | null
):
  | {
      environmentId: string
      worktreeId: string | null
      launchAgent: (agent: TuiAgent, label: string) => void
    }
  | undefined {
  if (selectedHost === FLOATING_HOST_THIS_COMPUTER) {
    return undefined
  }
  return {
    environmentId: selectedHost,
    worktreeId: remoteWorkspaceId,
    launchAgent: (agent, label) => {
      if (!remoteWorkspaceId) {
        toast.error(
          translate(
            'components.floatingWorkspace.hostNoWorkspace',
            FLOATING_HOST_NO_WORKSPACE_REASON
          )
        )
        return
      }
      launchAgentOnHostWorkspace(agent, label, remoteWorkspaceId, selectedHost)
    }
  }
}
