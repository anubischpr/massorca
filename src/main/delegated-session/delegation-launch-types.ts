import type { DelegationPlacement } from '../../shared/delegated-session-types'
import type {
  DelegationRequestPatch,
  DelegationRequestRow
} from '../runtime/orchestration/db/delegation/delegation-request-store'
import type { DelegationHostDeps, DelegationParentSession } from './delegation-service-types'

/** What an answered request starts: the agent, model and effort, and where the child runs. */
export type DelegationLaunchTarget = {
  agent: string
  label: string
  model: string | null
  effort: string | null
  placement: DelegationPlacement
  /** Whether the host picked the agent (Automatic) or the person did. */
  automatic: boolean
}

export type DelegationLaunchResult = {
  runId: string
  taskId: string
  dispatchId: string
  /** Null when the agent ran as a terminal, which has no chat to link. */
  childSessionId: string | null
}

/** Starts the child; throws with the reason when it cannot. */
export type DelegationLauncher = (input: {
  request: DelegationRequestRow
  parent: DelegationParentSession
  target: DelegationLaunchTarget
  /** Saves ids the launch learns before it ends, so a crash mid-launch leaves them on the row. */
  record: (patch: DelegationRequestPatch) => void
}) => Promise<DelegationLaunchResult>

export type DelegationAnswerDeps = DelegationHostDeps & {
  launch: DelegationLauncher
  warn: (message: string, error: unknown) => void
}
