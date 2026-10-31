import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { PrototypeSystemCard } from '../../shared/prototype-design-system-card'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { DelegationRankingCandidate } from './delegation-agent-ranking'
import {
  DELEGATION_AUTOMATIC_OPTION_ID,
  delegationAgentOptionId,
  type DelegationCardAgent,
  type DelegationCardPayload,
  type DelegationPrototypeCount
} from '../../shared/delegated-session-journal'
import type { AgentJournalPromptOption } from '../../shared/agent-session-journal-types'
import type {
  DelegationDecision,
  DelegationRouteResult,
  DelegationTier
} from '../../shared/delegated-session-types'
import { delegationUsageCandidates } from './delegation-usage-input'
import { classifyDelegationTask, withAdvisedDelegationTier } from './delegation-task-classifier'
import {
  delegationLaunchCatalog,
  resolveLaunchableDelegationModel
} from './delegation-launch-preferences'
import {
  decideDelegation,
  delegationPlacementFor,
  type DelegationWorkspaceKind
} from './delegation-router'

/** An agent this host can run a child on, stored with the request so an answer needs no re-detection. */
export type DelegationStoredAgent = {
  agent: string
  label: string
  piRuntime?: PiRuntimeSelection
}

export type DelegationRoutingInput = {
  summary: string
  writes: boolean
  workspaceKind: DelegationWorkspaceKind
  parentAgent: string | null
  agents: readonly DelegationStoredAgent[]
  /** Null when this host reads no usage at all; every agent then counts as having no data. */
  rateLimits: RateLimitState | null
  now: number
  advisedTier?: DelegationTier
}

/** Picks a task's tier from outside the classifier; null keeps the classifier's tier. */
export type DelegationTierAdvisor = (task: {
  summary: string
  writes: boolean
}) => Promise<DelegationTier | null>

function usageCandidates(input: DelegationRoutingInput): DelegationRankingCandidate[] {
  return input.rateLimits === null
    ? input.agents.map(({ agent }) => ({ agent, usage: null }))
    : delegationUsageCandidates(
        input.rateLimits,
        input.agents.map(({ agent, piRuntime }) => ({
          agent,
          ...(piRuntime ? { piRuntime } : {})
        }))
      )
}

/**
 * The router's answer for the request's agents right now, with model and effort as worker-start can
 * apply them: clamped to what each agent's catalog accepts, and no effort where no model is named.
 */
export function routeDelegationRequest(input: DelegationRoutingInput): DelegationRouteResult {
  const classification = classifyDelegationTask({
    summary: input.summary,
    writesCode: input.writes
  })
  const { tier } =
    input.advisedTier === undefined
      ? classification
      : withAdvisedDelegationTier(classification, input.advisedTier)
  const catalogs = Object.fromEntries(
    input.agents.map(({ agent }) => [agent, delegationLaunchCatalog(agent, tier)])
  )
  const route = decideDelegation({
    summary: input.summary,
    writesCode: input.writes,
    workspaceKind: input.workspaceKind,
    parentAgent: input.parentAgent,
    candidates: usageCandidates(input),
    now: input.now,
    catalogs,
    ...(input.advisedTier === undefined ? {} : { advisedTier: input.advisedTier })
  })
  return route.status === 'routed' && route.decision.model === null
    ? { status: 'routed', decision: { ...route.decision, effort: null } }
    : route
}

/** The deterministic route, with its tier replaced when the advisor answers. */
export async function routeDelegationRequestWithAdvice(
  input: DelegationRoutingInput,
  adviseTier: DelegationTierAdvisor | undefined
): Promise<DelegationRouteResult> {
  const route = routeDelegationRequest(input)
  // Why: with no agent to start there is nothing to tier, so no paid call.
  if (!adviseTier || route.status !== 'routed') {
    return route
  }
  try {
    const advisedTier = await adviseTier({ summary: input.summary, writes: input.writes })
    return advisedTier === null ? route : routeDelegationRequest({ ...input, advisedTier })
  } catch {
    return route
  }
}

function describeUsage(agent: DelegationCardAgent): string {
  const { usage } = agent
  if (usage.excluded === 'limit-reached') {
    return 'Limit reached'
  }
  const period = usage.monthly ? ' this month' : ''
  const used = usage.noData ? 'No usage data' : `${Math.round(usage.bindingPercent)}% used${period}`
  return usage.excluded === 'usage-limit' ? `${used} · near its limit` : used
}

function describeCardAgent(agent: DelegationCardAgent): string {
  return [describeUsage(agent), agent.model, agent.effort]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ')
}

/** Every agent in ranking order, each with the model and effort this task would get on it. */
function cardAgentsFor(
  route: DelegationRouteResult,
  agents: readonly DelegationStoredAgent[]
): DelegationCardAgent[] {
  const ranking = route.status === 'routed' ? route.decision.ranking : route.ranking
  const tier = route.status === 'routed' ? route.decision.tier : route.tier
  return ranking.flatMap((usage) => {
    const stored = agents.find((entry) => entry.agent === usage.agent)
    if (!stored) {
      return []
    }
    const { model, effort } = resolveLaunchableDelegationModel({ agent: usage.agent, tier })
    return [{ agent: stored.agent, label: stored.label, usage, model, effort }]
  })
}

export type DelegationCardContent = {
  payload: DelegationCardPayload
  options: AgentJournalPromptOption[]
}

/** The card's typed payload and the plain options an older client draws from the same data. */
export function buildDelegationCardContent(input: {
  requestId: string
  title: string
  route: DelegationRouteResult
  agents: readonly DelegationStoredAgent[]
  writes: boolean
  workspaceKind: DelegationWorkspaceKind
  /** The count question of a task that asks for prototypes; absent for any other task. */
  prototypeCount?: DelegationPrototypeCount
  /** The design system question of a task that asks for prototypes; absent for any other task. */
  designSystem?: PrototypeSystemCard
}): DelegationCardContent {
  const decision: DelegationDecision | null =
    input.route.status === 'routed' ? input.route.decision : null
  const cardAgents = cardAgentsFor(input.route, input.agents)
  const placement = delegationPlacementFor(input.writes, input.workspaceKind)
  const options: AgentJournalPromptOption[] = []
  if (decision) {
    const picked = cardAgents.find((entry) => entry.agent === decision.agent)
    options.push({
      id: DELEGATION_AUTOMATIC_OPTION_ID,
      label: 'Automatic',
      ...(picked ? { description: `Picks the agent with the most headroom: ${picked.label}` } : {})
    })
  }
  for (const entry of cardAgents) {
    options.push({
      id: delegationAgentOptionId(entry.agent),
      label: entry.label,
      description: describeCardAgent(entry)
    })
  }
  return {
    options,
    payload: {
      requestId: input.requestId,
      title: input.title,
      decision,
      agents: cardAgents,
      placement: placement.placement,
      placementWarning: placement.placementWarning,
      ...(input.prototypeCount ? { prototypeCount: input.prototypeCount } : {}),
      ...(input.designSystem ? { designSystem: input.designSystem } : {})
    }
  }
}
