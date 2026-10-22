// `agentSession.providerCommand`: run a command the provider answers for its chat, through the same
// admission, ledger and journal path every other session mutation takes. What the command has to
// say lands as a status row keyed by the operation, so a replay upserts the one row.

import { refuse, type AgentSessionRefusalReason } from '../../../shared/agent-session-wire-refusals'
import type { AgentJournalItemIdentity } from '../../../shared/agent-session-journal-types'
import type {
  AgentSessionProviderCommand,
  AgentSessionProviderCommandResult
} from '../../../shared/agent-session-provider-command'
import type { AgentSessionMutationEnvelope } from '../../../shared/agent-session-wire'
import { AGENT_SESSION_COMMAND_RESULT_PRESENTATION } from '../../../shared/native-chat-command-result'
import type { MutationPlan } from './structured-agent-session-mutation-plans'
import type { AgentSessionTurnContext, TurnOutcome } from './structured-agent-session-turns'

function refused(
  reason: AgentSessionRefusalReason<'agent_session_operation_invalid'>,
  message: string
): TurnOutcome<AgentSessionProviderCommandResult> {
  return { ok: false, refusal: refuse('agent_session_operation_invalid', { reason }, message) }
}

function noticeIdentity(clientOperationId: string): AgentJournalItemIdentity {
  return { provider: 'orca', clientMessageId: `provider-command:${clientOperationId}` }
}

/** Commands that start provider work or create something: running one twice is not the same as once. */
const REPEAT_UNSAFE: ReadonlySet<AgentSessionProviderCommand> = new Set([
  'fork',
  'review',
  'approve'
])

export async function performProviderCommand(
  ctx: AgentSessionTurnContext,
  input: { clientOperationId: string; command: AgentSessionProviderCommand; argument?: string }
): Promise<TurnOutcome<AgentSessionProviderCommandResult>> {
  const { command } = input
  const declared = ctx.agents.capabilities(ctx.agent)?.providerCommands
  if (!ctx.adapter.runProviderCommand || !declared?.includes(command)) {
    return refused('providerRejected', `/${command} is not available for this chat session.`)
  }
  const outcome = await ctx.adapter.runProviderCommand({
    sessionId: ctx.sessionId,
    fence: ctx.fence,
    command,
    ...(input.argument === undefined ? {} : { argument: input.argument })
  })
  if (!outcome.ok) {
    return refused('providerRejected', outcome.rejected)
  }
  if (outcome.notice) {
    const { text, presentation, tone } = outcome.notice
    await ctx.journal.appendItem(
      noticeIdentity(input.clientOperationId),
      {
        kind: 'status',
        text,
        // Shown outside the work fold, as what the command printed.
        presentation: presentation ?? AGENT_SESSION_COMMAND_RESULT_PRESENTATION,
        ...(tone ? { tone } : {})
      },
      { fence: ctx.fence, turnScope: ctx.journal.liveTurnScope() }
    )
  }
  return {
    ok: true,
    value: {
      command,
      ...(outcome.forkedProviderSessionId
        ? { forkedProviderSessionId: outcome.forkedProviderSessionId }
        : {}),
      ...(outcome.conversationName ? { conversationName: outcome.conversationName } : {})
    }
  }
}

export function providerCommandPlan(params: {
  envelope: AgentSessionMutationEnvelope
  command: AgentSessionProviderCommand
  argument?: string
}): MutationPlan<AgentSessionProviderCommandResult> {
  const { command, argument } = params
  return {
    method: 'agentSession.providerCommand',
    fields: { command, ...(argument === undefined ? {} : { argument }) },
    run: (ctx) =>
      performProviderCommand(ctx, {
        clientOperationId: params.envelope.clientOperationId,
        command,
        ...(argument === undefined ? {} : { argument })
      }),
    // The row, not the provider, carries a finished command's answer; a replay says only that it ran.
    replay: (_ctx, outcome) => (outcome.status === 'succeeded' ? { command } : null),
    rerunWhenReplayMissing: () => !REPEAT_UNSAFE.has(command)
  }
}
