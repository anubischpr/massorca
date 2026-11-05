import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import {
  loadFloatingHostSession,
  openCreateChatWorkspace,
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
  const floating = placement === 'floating-workspace' ? await loadFloatingHostSession() : null
  const knownTabIds = floating?.knownSessionTabIds(worktreeId)
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
    floating?.showHostSessionInFloating(worktreeId, launched.surface.tabId)
  } else if (floating && knownTabIds) {
    // Why: a host-published tab arrives later under the host's own id.
    floating.showWhenHostPublishes(worktreeId, knownTabIds)
  }
  return 'opened'
}
