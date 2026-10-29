export type MobileSessionHeaderMenuInput = {
  /** The worktree has a chat for Plan, Summary and Artifacts to act on. */
  hasChatSession: boolean
  /** The workspace offers its agent session history to resume (the old Agent History route). */
  showAgentHistory: boolean
  /** Git worktrees only: folder and floating workspaces have no source control. */
  hasSourceControl: boolean
  /** The hosted checks action, under the same provider and repo rules as before. */
  showChecks: boolean
}

export type MobileSessionHeaderMenu = {
  /** The ⋯ button shows when at least one item applies; the chat items always do. */
  showButton: boolean
  /** Without a chat, Plan, Summary and Artifacts stay listed but show disabled, with the reason. */
  hasChatSession: boolean
  chat: {
    /** Only without a chat in the worktree: beside one, the Sessions sheet holds the resume row. */
    agentHistory: boolean
    plan: boolean
    summary: boolean
    artifacts: boolean
    prototypes: boolean
    quickCommands: boolean
  }
  environment: { branch: boolean; checks: boolean }
}

/**
 * The same menu in every pane: what it offers follows the worktree, never the pane that is open.
 * The chat items act on the worktree's chat, so they stay offered and show disabled without one.
 */
export function resolveMobileSessionHeaderMenu(
  input: MobileSessionHeaderMenuInput
): MobileSessionHeaderMenu {
  const chat = {
    agentHistory: !input.hasChatSession && input.showAgentHistory,
    plan: true,
    summary: true,
    artifacts: true,
    prototypes: true,
    quickCommands: true
  }
  const environment = { branch: input.hasSourceControl, checks: input.showChecks }
  const showButton = Object.values(chat).some(Boolean) || Object.values(environment).some(Boolean)
  return { showButton, hasChatSession: input.hasChatSession, chat, environment }
}
