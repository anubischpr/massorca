import type { PersistedTrustedOrcaHooks } from '../../../src/shared/orca-yaml-hook-types'
import type { SetupHookDetails } from '../components/new-worktree-modal-types'
import { AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE } from '../session/mobile-existing-agent-launch'
import { isSetupHookTrusted } from '../tasks/setup-hook-trust'
import { AGENT_DEFAULT_TAB_NOTE, type AgentLaunchSupport } from '../tasks/agent-launch-request'
import type { WorkspaceCreateSetupDecision } from '../tasks/workspace-create-params'
import type { CreateSessionWorkspaceMode } from './create-session-model'

const FULL_FORM_HINT = 'Open More options, then Name, branch and setup script.'

export type CreateSessionSetup = {
  decision: WorkspaceCreateSetupDecision
  /** Said before sending and again on landing, when the script is not going to run. */
  notice: string | null
}

/**
 * What a phone tap may do with a repo setup script. It runs only when its current content was
 * approved before, as the full form requires; otherwise it is skipped and the screen says so.
 * A project that asks every time cannot be asked here, so it is skipped too.
 */
export function resolveCreateSessionSetup(args: {
  /** Null when the hooks could not be read, so whether a script exists is unknown. */
  details: SetupHookDetails | null
  trustedHooks: PersistedTrustedOrcaHooks
}): CreateSessionSetup {
  const { details, trustedHooks } = args
  if (!details) {
    return { decision: 'skip', notice: null }
  }
  if (!details.command) {
    return { decision: 'inherit', notice: null }
  }
  if (
    !details.trust ||
    !isSetupHookTrusted(trustedHooks, details.repoId, details.trust.contentHash)
  ) {
    return {
      decision: 'skip',
      notice: `The setup script is not trusted yet, so it will be skipped. ${FULL_FORM_HINT}`
    }
  }
  if (details.runPolicy === 'ask') {
    return {
      decision: 'skip',
      notice: `This project asks before running its setup script, so it will be skipped. ${FULL_FORM_HINT}`
    }
  }
  return { decision: details.runPolicy === 'skip-by-default' ? 'skip' : 'run', notice: null }
}

/** For hosts that ignore the chat preference: they open their default kind of tab. */
export function createSessionModeNote(support: AgentLaunchSupport | false | null): string | null {
  return support && support.preferredMode !== true ? AGENT_DEFAULT_TAB_NOTE : null
}

/** Why Send must stay off, or null. Never a dead end: every message names the way out. */
export function createSessionLaunchBlocker(args: {
  /** Null while the host capabilities are still being read. */
  support: AgentLaunchSupport | false | null
  workspaceMode: CreateSessionWorkspaceMode
}): string | null {
  if (args.support === null) {
    return null
  }
  if (args.support === false) {
    return `${AGENT_LAUNCH_UPDATE_REQUIRED_MESSAGE} ${FULL_FORM_HINT}`
  }
  if (args.workspaceMode === 'current-checkout' && !args.support.replay) {
    return 'Starting in the current checkout needs a newer MassOrca on your computer. Choose New worktree, or update it.'
  }
  return null
}
