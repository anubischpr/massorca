import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { DelegationRankingCandidate } from './delegation-agent-ranking'
import {
  DELEGATION_AUTOMATIC_OPTION_ID,
  delegationAgentOptionId,
  type DelegationCardAgent,
  type DelegationCardPayload
} from '../../shared/delegated-session-journal'
import type { AgentJournalPromptOption } from '../../shared/agent-session-journal-types'
import type {
  DelegationDecision,
  DelegationRouteResult
} from '../../shared/delegated-session-types'
import { delegationUsageCandidates } from './delegation-usage-input'
import { classifyDelegationTask } from './delegation-task-classifier'
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
}

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
  const { tier } = classifyDelegationTask({ summary: input.summary, writesCode: input.writes })
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
    catalogs
  })
  return route.status === 'routed' && route.decision.model === null
    ? { status: 'routed', decision: { ...route.decision, effort: null } }
    : route
}

function describeUsage(agent: DelegationCardAgent): string {
  const { usage } = agent
  if (usage.excluded === 'limit-reached') {
    return 'Limit reached'
  }
  const used = usage.noData ? 'No usage data' : `${Math.round(usage.bindingPercent)}% used`
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
      placementWarning: placement.placementWarning
    }
  }
}
