import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import type { StructuredAgentSessionSinkQueue } from './structured-agent-session-event-sink-queue'

/** What a provider reports; the host stamps the source. */
export type StructuredAgentSessionPromptSuggestion = Pick<
  NativeChatReplySuggestion,
  'turnId' | 'text'
>

/** The deferred sink's suggestion channel: a publication, never a journal write, and the newest
 *  one waiting replaces an older one. */
export function promptSuggestionSinkMember(queue: StructuredAgentSessionSinkQueue) {
  return {
    setPromptSuggestion: (suggestion: StructuredAgentSessionPromptSuggestion | null): void => {
      queue.submit({
        bytes: Buffer.byteLength(JSON.stringify(suggestion), 'utf8') + 64,
        publicationKey: 'prompt-suggestion',
        run: (bound) => bound.publishPromptSuggestion?.(suggestion)
      })
    }
  }
}
