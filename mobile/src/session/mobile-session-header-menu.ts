export type MobileSessionHeaderMenuInput = {
  /** The screen shows a native chat, which the Chat section describes. */
  showNativeChat: boolean
  /** The workspace offers its agent session history to resume (the old Agent History route). */
  showAgentHistory: boolean
  /** Git worktrees only: folder and floating workspaces have no source control. */
  hasSourceControl: boolean
  /** The hosted checks action, under the same provider and repo rules as before. */
  showChecks: boolean
  /** The chat has a plan with at least one step. */
  hasPlan: boolean
}

export type MobileSessionHeaderMenu = {
  /** The ⋯ button shows when at least one item applies, in any workspace kind. */
  showButton: boolean
  chat: {
    sessions: boolean
    /** Only without a native chat: beside one, Sessions holds the resume row instead. */
    agentHistory: boolean
    plan: boolean
    summary: boolean
    artifacts: boolean
  }
  environment: { branch: boolean; checks: boolean }
}

export function resolveMobileSessionHeaderMenu(
  input: MobileSessionHeaderMenuInput
): MobileSessionHeaderMenu {
  const chat = {
    sessions: input.showNativeChat,
    agentHistory: !input.showNativeChat && input.showAgentHistory,
    plan: input.showNativeChat && input.hasPlan,
    summary: input.showNativeChat,
    artifacts: input.showNativeChat
  }
  const environment = { branch: input.hasSourceControl, checks: input.showChecks }
  const showButton = Object.values(chat).some(Boolean) || Object.values(environment).some(Boolean)
  return { showButton, chat, environment }
}
