import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import {
  isFloatingPlacement,
  loadFloatingCreateLaunch,
  openCreateChatWorkspace,
  workspaceTabIds,
  type CreateChatPlacement
} from './create-chat-placement'
import type { CreateChatSelection } from './create-chat-selection'

export type CreateChatTerminalLaunch = 'opened' | 'workspace-unavailable' | 'not-started'

/** Opens the workspace, then the agent in a terminal tab through the terminal route, with the first message. */
export async function launchTerminalInWorkspace(
  worktreeId: string,
  draft: string,
  selection: CreateChatSelection,
  placement: CreateChatPlacement = 'main-window'
): Promise<CreateChatTerminalLaunch> {
  if (!openCreateChatWorkspace(worktreeId, placement)) {
    return 'workspace-unavailable'
  }
  const floating = isFloatingPlacement(placement) ? placement : null
  const knownTabIds = floating ? workspaceTabIds(worktreeId) : new Set<string>()
  // Why: loaded late, as the chat launch's admission module does; the chat path never needs this graph.
  const { launchAgentInNewTab } = await import('@/lib/launch-agent-in-new-tab')
  const launched = launchAgentInNewTab({
    agent: selection.agent,
    worktreeId,
    prompt: draft,
    promptDelivery: 'auto-submit',
    activate: floating === null,
    agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
      route: 'terminal-tui',
      requestId: newAgentLaunchRequestId(),
      agent: selection.agent,
      worktreeId,
      prompt: draft,
      promptDelivery: 'auto-submit'
    })
  })
  if (!launched) {
    return 'not-started'
  }
  if (launched.surface.kind === 'local-terminal') {
    // Why: the tab is named as terminal view here, rather than left to the store's default for a missing mode.
    useAppStore.getState().setTabViewMode(launched.surface.tabId, 'terminal')
  }
  if (floating) {
    // Why: a host-published tab arrives later under the host's own id, so its session tab is waited for.
    const tabId = launched.surface.kind === 'local-terminal' ? launched.surface.tabId : null
    void loadFloatingCreateLaunch().then((floatingLaunch) =>
      floatingLaunch.showFloatingCreateLaunch({
        worktreeId,
        tabId,
        knownTabIds,
        createTabId: floating.createTabId
      })
    )
  }
  return 'opened'
}
