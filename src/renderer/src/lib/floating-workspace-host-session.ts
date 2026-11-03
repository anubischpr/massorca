import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../shared/tui-agent'
import { newAgentLaunchRequestId } from './agent-launch-request-id'
import { useFloatingWorkspaceHostStore } from './floating-workspace-host-store'
import { launchAgentInNewTab } from './launch-agent-in-new-tab'
import { focusTerminalTabSurface } from './focus-terminal-tab-surface'
import {
  awaitNewSessionTab,
  showSessionInFloatingWorkspace
} from './show-session-in-floating-workspace'

/** Shows a session that runs on a paired host in the floating workspace; a refusal is said out loud. */
export function showHostSessionInFloating(worktreeId: string, tabId: string): boolean {
  const shown = showSessionInFloatingWorkspace({ worktreeId, tabId }, useAppStore)
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
  const knownTabIds = new Set(
    (useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? []).map((tab) => tab.id)
  )
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
  void awaitNewSessionTab(
    { worktreeId, knownTabIds, timeoutMs: HOST_SESSION_WAIT_MS },
    useAppStore
  ).then((tabId) => {
    if (tabId) {
      showHostSessionInFloating(worktreeId, tabId)
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

/** The "+" menu's host while a paired host is selected: it lists that host's agents and shells, and starts agents there. */
export function floatingCreateHost(
  selectedHost: string,
  remoteWorkspaceId: string | null
): { worktreeId: string; launchAgent: (agent: TuiAgent, label: string) => void } | undefined {
  if (!remoteWorkspaceId) {
    return undefined
  }
  return {
    worktreeId: remoteWorkspaceId,
    launchAgent: (agent, label) =>
      launchAgentOnHostWorkspace(agent, label, remoteWorkspaceId, selectedHost)
  }
}
