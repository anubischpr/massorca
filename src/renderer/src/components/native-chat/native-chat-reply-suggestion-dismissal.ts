import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'

/** Tells the host the chat dismissed a suggestion, so a host restart does not bring it back. An
 *  older host has no such method and refuses it, which leaves the chat's own dismissal in place. */
export function reportReplySuggestionDismissed(
  target: RuntimeClientTarget,
  sessionId: string,
  suggestion: NativeChatReplySuggestion
): void {
  void callStructuredAgentSession(target, 'agentSession.dismissPromptSuggestion', {
    sessionId,
    turnId: suggestion.turnId,
    text: suggestion.text
  }).catch(() => undefined)
}
