// Esc on a suggested next message, which the host keeps dismissed across its restarts. Not gated on
// admission, like the other methods that retire state a caller already owns, so a dismissal never
// waits on a turn. An older host lacks this method, and the client tolerates the refusal.

import { defineMethod } from '../core'
import { requireStructuredCleanupHost } from './structured-agent-session-gate'
import { DismissPromptSuggestionParams } from './structured-agent-session-schemas'

export const STRUCTURED_AGENT_SESSION_PROMPT_SUGGESTION_METHODS = [
  defineMethod({
    name: 'agentSession.dismissPromptSuggestion',
    permission: 'workspace',
    params: DismissPromptSuggestionParams,
    handler: async (params, ctx) => ({
      dismissed: requireStructuredCleanupHost(ctx).promptSuggestions.dismiss(params.sessionId, {
        turnId: params.turnId,
        text: params.text
      })
    })
  })
]
