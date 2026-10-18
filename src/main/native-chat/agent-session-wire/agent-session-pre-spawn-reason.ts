import type { AgentSessionRefusalReason } from '../../../shared/agent-session-refusal-details'

/** A refusal before spawn that a person can act on; the site that refused names it. */
export type AgentSessionPreSpawnReason = Extract<
  AgentSessionRefusalReason<'agent_session_operation_invalid'>,
  | 'managedAccountEnvOverride'
  | 'accountSwitchInProgress'
  | 'managedAccountUnsupported'
  | 'launchFolderMissing'
  | 'historyInOtherAccount'
  | 'agentCommandNotRunnable'
  | 'cliMissing'
  | 'antigravityCliVersionUnsupported'
>
