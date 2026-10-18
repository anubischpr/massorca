import { refuse, type AgentSessionOptionResult } from '../../../shared/agent-session-wire'
import { isAgentSessionOptionRejectedError } from './structured-agent-session-option-error'
import type { AgentSessionTurnContext, TurnOutcome } from './structured-agent-session-turns'

const ORCA_OWNED_OPTION_KEYS = ['accessMode', 'piRuntime'] as const

export async function performSetOption(
  ctx: AgentSessionTurnContext,
  input: { key: string; value: string },
  signal?: AbortSignal
): Promise<TurnOutcome<AgentSessionOptionResult>> {
  let applied: void | Readonly<Record<string, string>>
  try {
    applied = await ctx.adapter.setOption({
      sessionId: ctx.sessionId,
      ...input,
      fence: ctx.fence,
      ...(signal ? { signal } : {})
    })
  } catch (error) {
    if (isAgentSessionOptionRejectedError(error)) {
      return {
        ok: false,
        refusal: refuse(
          'agent_session_operation_invalid',
          { reason: error.refusalReason },
          error.message
        )
      }
    }
    throw error
  }
  // The child reports only its own options; the launch selections Orca keeps stay with the record,
  // and a live access pick is the record's to hold once the child has taken it.
  const kept: Record<string, string> = {}
  for (const key of ORCA_OWNED_OPTION_KEYS) {
    const value = ctx.persistedOptions?.[key]
    if (value !== undefined) {
      kept[key] = value
    }
  }
  const persisted = {
    ...kept,
    ...(applied ?? { [input.key]: input.value }),
    ...(input.key === 'accessMode' ? { accessMode: input.value } : {})
  }
  await ctx.persistOptions(persisted)
  ctx.publish()
  return { ok: true, value: { ...input, ...(applied ? { options: persisted } : {}) } }
}
