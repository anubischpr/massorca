import type { AgentChildWorkView } from './agent-status-child-work-view'
import type { AgentSessionQueuePublicationFields } from './agent-session-queued-message-wire'

/** Every published frame: the host wall clock (ms epoch, see `AgentSessionHistoryPage`), and what
 *  rides beside its `queuedMessages`. */
export type AgentSessionFrameFields = {
  hostNow?: number
  commandActivity?: AgentChildWorkView[]
} & AgentSessionQueuePublicationFields
