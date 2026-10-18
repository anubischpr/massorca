import type { AgentSessionSubscribeEvent } from '../../../../shared/agent-session-wire'
import { AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY } from '../../../../shared/structured-agent-session-surface-capabilities'
import type { RpcContext } from '../core'

type PromptSuggestionReader = Pick<RpcContext, 'clientKind' | 'clientCapabilities'>

function readsPromptSuggestion(ctx: PromptSuggestionReader): boolean {
  // An in-process caller is this build; only a negotiated client can predate the field.
  return (
    ctx.clientKind === undefined ||
    ctx.clientCapabilities?.includes(AGENT_SESSION_PROMPT_SUGGESTION_RUNTIME_CAPABILITY) === true
  )
}

/** A client that never advertised the capability gets no suggestion field, so the host spends no
 *  bytes on state that client cannot draw. */
export function projectPromptSuggestionEvent(
  event: AgentSessionSubscribeEvent,
  ctx: PromptSuggestionReader
): AgentSessionSubscribeEvent {
  if (!('promptSuggestion' in event) || readsPromptSuggestion(ctx)) {
    return event
  }
  const { promptSuggestion: _promptSuggestion, ...legacy } = event
  return legacy
}
