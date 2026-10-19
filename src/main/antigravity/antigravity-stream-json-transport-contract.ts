import type {
  ManagedProviderProcess,
  ProviderProcessExit
} from '../provider-process/managed-provider-process'
import type { ProviderProcessLaunch } from '../provider-process/provider-process-launch'
import type {
  AntigravityFrameFieldKinds,
  AntigravityStreamResult,
  AntigravityStreamStepUpdate
} from './antigravity-stream-json-protocol'

export type AntigravityStreamTransportEvent =
  | { type: 'initialized'; conversationId: string }
  | {
      type: 'step_update'
      step: AntigravityStreamStepUpdate
      clientMessageId: string
      requestedAt: number
    }
  | {
      type: 'result'
      result: AntigravityStreamResult
      clientMessageId: string
      terminal: boolean
    }
  /** A step frame that could not be read; the session continues without it. */
  | { type: 'unclassified_step'; field: string; fieldKinds: AntigravityFrameFieldKinds }

export type AntigravityStreamJsonTransportOptions = {
  launch: ProviderProcessLaunch
  onEvent: (event: AntigravityStreamTransportEvent) => void
  onError: (error: Error) => void
  onExit?: (exit: ProviderProcessExit) => void
  maxLineBytes?: number
  processFactory?: (launch: ProviderProcessLaunch) => ManagedProviderProcess
}

export type AntigravityPendingPrompt = {
  clientMessageId: string
  message: string
  resolve: (result: AntigravityStreamResult) => void
  reject: (error: Error) => void
  accepted: boolean
  acceptedStepIndex: number | null
  requestedAt: number
}
