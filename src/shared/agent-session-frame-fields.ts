import type { AgentChildWorkView } from './agent-status-child-work-view'
import type { AgentSessionQueuePublicationFields } from './agent-session-queued-message-wire'
import type { NativeChatReplySuggestion } from './native-chat-reply-suggestion'

/** Every published frame: the host wall clock (ms epoch, see `AgentSessionHistoryPage`), and what
 *  rides beside its `queuedMessages`. */
export type AgentSessionFrameFields = {
  hostNow?: number
  commandActivity?: AgentChildWorkView[]
  /** The suggested next user message; null clears it. Ephemeral, host-retained for a late
   *  subscriber, and sent only to a client advertising the prompt-suggestion capability. */
  promptSuggestion?: NativeChatReplySuggestion | null
} & AgentSessionQueuePublicationFields
