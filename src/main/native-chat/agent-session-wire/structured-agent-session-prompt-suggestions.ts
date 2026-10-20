import type { AgentSessionSubscribeEvent } from '../../../shared/agent-session-wire'
import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import { emptyAgentSessionBatch } from './agent-session-empty-batch'
import { rememberSessionActivity } from './structured-agent-session-activity-retention'
import type { Subscriber } from './structured-agent-session-subscribers'

export type PromptSuggestionPort = {
  subscribers: (sessionId: string) => Subscriber[]
  emit: (subscriber: Subscriber, event: AgentSessionSubscribeEvent) => void
  now: () => number
  /** Whether a suggestion from this source may be published; absent allows both. */
  isEnabled?: (source: NativeChatReplySuggestion['source']) => boolean
}

/**
 * Each session's suggested next user message, held so a subscriber that opens after it arrived
 * still gets it with no new generation, and sent to the live ones as frames that advance nothing.
 * The next turn clears it. Held in memory only: a host restart drops it, and nothing regenerates
 * it until the next turn settles.
 */
export class StructuredAgentSessionPromptSuggestions {
  private readonly held = new Map<string, NativeChatReplySuggestion>()

  constructor(private readonly port: PromptSuggestionPort) {}

  get(sessionId: string): NativeChatReplySuggestion | undefined {
    return this.held.get(sessionId)
  }

  /** Only while one is held: an opening frame without the field reads as "no suggestion". */
  openingField(sessionId: string): { promptSuggestion?: NativeChatReplySuggestion } {
    const suggestion = this.held.get(sessionId)
    return suggestion ? { promptSuggestion: suggestion } : {}
  }

  /** Sets or, with null, clears it for every subscriber. A suggestion whose source the user turned
   *  off is dropped, not held. */
  publish(sessionId: string, suggestion: NativeChatReplySuggestion | null): void {
    if (suggestion && this.port.isEnabled?.(suggestion.source) === false) {
      return
    }
    if (suggestion) {
      rememberSessionActivity(this.held, sessionId, suggestion)
    } else if (!this.held.delete(sessionId)) {
      return
    }
    const hostNow = this.port.now()
    for (const subscriber of this.port.subscribers(sessionId)) {
      this.port.emit(subscriber, this.frame(subscriber, hostNow, suggestion))
    }
  }

  /** A resuming subscriber's caught-up frame carries no suggestion field; state it separately. */
  resend(subscriber: Subscriber, hostNow: number): void {
    const suggestion = this.held.get(subscriber.sessionId)
    if (suggestion) {
      this.port.emit(subscriber, this.frame(subscriber, hostNow, suggestion))
    }
  }

  private frame(
    subscriber: Subscriber,
    hostNow: number,
    promptSuggestion: NativeChatReplySuggestion | null
  ): AgentSessionSubscribeEvent {
    return {
      type: 'batch',
      sessionId: subscriber.sessionId,
      batch: emptyAgentSessionBatch(subscriber.cursor),
      fence: subscriber.fence,
      hostNow,
      promptSuggestion
    }
  }
}
