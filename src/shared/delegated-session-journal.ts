/**
 * What a delegated-session request writes into its parent chat. The card is an ordinary question
 * item and each notice an ordinary status item, so an older client draws their words; the optional
 * `delegation` field on either body carries the typed payload a newer client draws instead.
 */

import { z } from 'zod'
import { agentJournalItemKey, parseAgentJournalItemKey } from './agent-session-journal-item-key'
import type { AgentJournalItemBody, AgentJournalItemIdentity } from './agent-session-journal-types'
import type {
  DelegationAgentUsage,
  DelegationDecision,
  DelegationPlacement,
  DelegationPlacementWarning,
  DelegationReasonCode
} from './delegated-session-types'

const QUESTION_ROW_PREFIX = 'delegation:'
const NOTICE_ROW_PREFIX = 'delegation-notice:'
const AGENT_OPTION_PREFIX = 'agent:'

/** The option that lets the host pick the agent. */
export const DELEGATION_AUTOMATIC_OPTION_ID = 'automatic'

export function delegationAgentOptionId(agent: string): string {
  return `${AGENT_OPTION_PREFIX}${agent}`
}

export type DelegationChoice = { kind: 'automatic' } | { kind: 'agent'; agent: string }

export function parseDelegationOptionId(optionId: string): DelegationChoice | null {
  if (optionId === DELEGATION_AUTOMATIC_OPTION_ID) {
    return { kind: 'automatic' }
  }
  const agent = optionId.startsWith(AGENT_OPTION_PREFIX)
    ? optionId.slice(AGENT_OPTION_PREFIX.length)
    : ''
  return agent.length > 0 ? { kind: 'agent', agent } : null
}

/** One agent a request can run on, with the usage and the model and effort this task would get. */
export type DelegationCardAgent = {
  agent: string
  label: string
  usage: DelegationAgentUsage
  model: string | null
  effort: string | null
}

/** Rich-client payload on the choice card (`AgentJournalQuestionItem.delegation`). */
export type DelegationCardPayload = {
  requestId: string
  title: string
  /** What Automatic would pick now; null when no agent has headroom. */
  decision: DelegationDecision | null
  agents: DelegationCardAgent[]
  placement: DelegationPlacement
  placementWarning: DelegationPlacementWarning | null
}

type DelegationNoticeBase = { requestId: string; title: string }

export type DelegationStartedPayload = DelegationNoticeBase & {
  status: 'started'
  agent: string
  model: string | null
  effort: string | null
  childSessionId: string
  placement: DelegationPlacement
  /** Whether the host picked the agent (Automatic) or the person did. */
  automatic: boolean
}

export type DelegationFailedPayload = DelegationNoticeBase & {
  status: 'failed'
  reason: string
}

export type DelegationFinishedPayload = DelegationNoticeBase & {
  status: 'finished'
  outcome: 'succeeded' | 'failed'
  resultSummary: string
  childSessionId: string | null
  durationMs: number | null
}

/** Rich-client payload on a status notice (`AgentJournalStatusItem.delegation`). */
export type DelegationNoticePayload =
  | DelegationStartedPayload
  | DelegationFailedPayload
  | DelegationFinishedPayload

export type DelegationNoticeStatus = DelegationNoticePayload['status']

export function delegationQuestionRowIdentity(
  requestId: string
): Extract<AgentJournalItemIdentity, { provider: 'orca' }> {
  return { provider: 'orca', clientMessageId: `${QUESTION_ROW_PREFIX}${requestId}` }
}

export function delegationNoticeRowIdentity(
  requestId: string,
  status: DelegationNoticeStatus
): Extract<AgentJournalItemIdentity, { provider: 'orca' }> {
  return { provider: 'orca', clientMessageId: `${NOTICE_ROW_PREFIX}${requestId}:${status}` }
}

/** The request a choice card's journal key belongs to; null for any other item. */
export function delegationRequestIdOfQuestionItem(itemId: string): string | null {
  const identity = parseAgentJournalItemKey(itemId)
  if (identity?.provider !== 'orca' || !identity.clientMessageId.startsWith(QUESTION_ROW_PREFIX)) {
    return null
  }
  const requestId = identity.clientMessageId.slice(QUESTION_ROW_PREFIX.length)
  return requestId.length > 0 ? requestId : null
}

export function delegationQuestionItemId(requestId: string): string {
  return agentJournalItemKey(delegationQuestionRowIdentity(requestId))
}

/**
 * A question the host asks on its own behalf, not the provider's: no provider callback waits behind
 * it, so provider settlement sweeps and "waiting on you" gates leave it alone.
 */
export function isHostOwnedDelegationQuestion(body: AgentJournalItemBody): boolean {
  return body.kind === 'question' && body.delegation !== undefined
}

const NullableString = z.string().nullable()
const Placement = z.enum(['current', 'new-child'])
const Level = z.enum(['low', 'medium', 'high'])
const REASON_CODES: ReadonlySet<string> = new Set<DelegationReasonCode>([
  'lowest-usage',
  'parent-agent-tie',
  'fixed-order-tie',
  'no-usage-data',
  'high-risk-tier-floor',
  'model-unavailable',
  'effort-clamped',
  'read-only-current-worktree',
  'writes-new-child-worktree',
  'folder-workspace-writes'
])

const UsageSchema = z.object({
  agent: z.string(),
  bindingPercent: z.number(),
  window: z.enum(['session', 'weekly']).nullable(),
  noData: z.boolean(),
  excluded: z.enum(['usage-limit', 'limit-reached']).nullable()
})

// A reason code a newer host adds is dropped, not a reason to hide the whole card.
const ReasonsSchema = z
  .array(z.string())
  .transform((codes) =>
    codes.filter((code): code is DelegationReasonCode => REASON_CODES.has(code))
  )

const DecisionSchema = z.object({
  agent: z.string(),
  model: NullableString,
  effort: NullableString,
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  dimensions: z.object({
    risk: Level,
    complexity: Level,
    verifiability: Level,
    ambiguity: Level
  }),
  placement: Placement,
  placementWarning: z.literal('folder-workspace-writes').nullable(),
  ranking: z.array(UsageSchema),
  reasons: ReasonsSchema
})

const CardSchema = z.object({
  requestId: z.string().min(1),
  title: z.string(),
  decision: DecisionSchema.nullable().catch(null),
  agents: z.array(
    z.object({
      agent: z.string(),
      label: z.string(),
      usage: UsageSchema,
      model: NullableString,
      effort: NullableString
    })
  ),
  placement: Placement,
  placementWarning: z.literal('folder-workspace-writes').nullable().catch(null)
})

const NoticeBase = { requestId: z.string().min(1), title: z.string() }

const NoticeSchema = z.discriminatedUnion('status', [
  z.object({
    ...NoticeBase,
    status: z.literal('started'),
    agent: z.string(),
    model: NullableString,
    effort: NullableString,
    childSessionId: z.string(),
    placement: Placement,
    automatic: z.boolean().catch(false)
  }),
  z.object({ ...NoticeBase, status: z.literal('failed'), reason: z.string() }),
  z.object({
    ...NoticeBase,
    status: z.literal('finished'),
    outcome: z.enum(['succeeded', 'failed']),
    resultSummary: z.string(),
    childSessionId: NullableString.catch(null),
    durationMs: z.number().nullable().catch(null)
  })
])

/** A router decision as stored or published, or null when it is not one. */
export function readDelegationDecision(value: unknown): DelegationDecision | null {
  const parsed = DecisionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** The card payload as a client may trust it, or null when the field is absent or malformed. */
export function readDelegationCardPayload(value: unknown): DelegationCardPayload | null {
  const parsed = CardSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** The notice payload as a client may trust it, or null when the field is absent or malformed. */
export function readDelegationNoticePayload(value: unknown): DelegationNoticePayload | null {
  const parsed = NoticeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
