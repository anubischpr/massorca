import type { TerminalCreateOptions } from './runtime-terminal-contracts'
import { resolveTerminalPresentation } from './orca-runtime-core'
export type { TerminalCreateOptions } from './runtime-terminal-contracts'
export type { Worktree } from '../../shared/worktree/types'
export type { RuntimeTerminalCreate } from '../../shared/runtime-types'
export {
  createTerminalRevealWarning,
  ownerSurfacing,
  resolveTerminalPresentation
} from './orca-runtime-core'
export { makePaneKey } from '../../shared/stable-pane-id'
export { randomUUID } from 'node:crypto'
export {
  admitStablePaneAdoption,
  allocateTerminalPaneIdentity
} from './runtime-terminal-pane-identity'
export {
  copySleepingAgentLaunchConfig,
  inferCapturedClaudeAgentTeamsMode,
  mergeTerminalEnvDeletionKeys
} from './runtime-agent-launch-resolution'
export { buildClaudeAgentTeamsLaunchPlan } from './claude-agent-teams-shim-env'
export {
  addClaudeTeammateModeAuto,
  addClaudeTeammateModeInProcess
} from '../../shared/claude-agent-teams-tmux-compat'
export { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../shared/setup-agent-sequencing'
export { getTerminalViewerColors, setPairedViewerColors } from './terminal-view-attribute-store'
export { normalizeColorQueryReplyColors } from '../../shared/pty-owner-color-query-colors'
export type { RuntimePtyController } from './runtime-pty-controller-contract'
export { getRuntimeDesktopSurface } from './runtime-desktop-surface'
export { runtimeNewTabPlacement } from './runtime-terminal-spawn-placement'
export type { IpcMainEvent } from 'electron'

// Why initiallyHidden: no renderer pane exists yet, so main must answer startup queries — Muse
// exits silently when its startup cursor-position query goes unanswered.
export const BACKGROUND_TERMINAL_SPAWN_FLAGS = {
  initiallyHidden: true,
  persistHostSessionBinding: true
} as const

// Why: a run that shows no session tab stays background, so no renderer reveals it.
export function resolveRunPresentation(opts: TerminalCreateOptions) {
  return opts.noSessionTab === true ? 'background' : resolveTerminalPresentation(opts)
}

// Why: a run that shows no session tab is never saved as one, so a restore cannot bring it back.
export function backgroundSpawnFlags(opts: TerminalCreateOptions) {
  return opts.noSessionTab === true
    ? { ...BACKGROUND_TERMINAL_SPAWN_FLAGS, persistHostSessionBinding: false }
    : BACKGROUND_TERMINAL_SPAWN_FLAGS
}

// Why: a run that shows no session tab is never published to paired clients.
export function publishesMobileSessionTab(
  launchOpts: Pick<TerminalCreateOptions, 'deferMobileSessionPublish'>,
  opts: TerminalCreateOptions
): boolean {
  return launchOpts.deferMobileSessionPublish !== true && opts.noSessionTab !== true
}
