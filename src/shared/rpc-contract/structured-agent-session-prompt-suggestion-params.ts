// Esc on a suggested next message: the host drops it for every client and keeps it dropped across a
// restart. An older host has no such method, so a client that calls it must tolerate the refusal.
import { z } from 'zod'
import { MAX_REPLY_SUGGESTION_LENGTH } from '../native-chat-reply-suggestion'
import { Identifier, SessionId } from './structured-agent-session-identifiers'

// Strict like the rest of the agentSession surface: a field a newer client adds must not change this
// host's answer.
export const DismissPromptSuggestionParams = z
  .object({
    sessionId: SessionId,
    turnId: Identifier('Invalid turn id'),
    text: z.string().min(1).max(MAX_REPLY_SUGGESTION_LENGTH)
  })
  .strict()
