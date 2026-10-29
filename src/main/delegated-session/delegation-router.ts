import type {
  DelegationPlacement,
  DelegationPlacementWarning,
  DelegationReasonCode,
  DelegationRouteResult
} from '../../shared/delegated-session-types'
import { classifyDelegationTask } from './delegation-task-classifier'
import { rankDelegationAgents, type DelegationRankingCandidate } from './delegation-agent-ranking'
import { resolveDelegationModel, type DelegationModelCatalog } from './delegation-model-tiers'

export type DelegationWorkspaceKind = 'git' | 'folder'

export type DelegationRouteInput = {
  summary: string
  writesCode: boolean
  workspaceKind: DelegationWorkspaceKind
  parentAgent: string | null
  candidates: readonly DelegationRankingCandidate[]
  now: number
  staleAfterMs?: number
  /** Model catalogs keyed by agent id; an agent without one keeps its table model and effort. */
  catalogs?: Readonly<Record<string, DelegationModelCatalog | undefined>>
}

export type DelegationPlacementChoice = {
  placement: DelegationPlacement
  placementWarning: DelegationPlacementWarning | null
  reason: DelegationReasonCode
}

export function delegationPlacementFor(
  writesCode: boolean,
  workspaceKind: DelegationWorkspaceKind
): DelegationPlacementChoice {
  if (!writesCode) {
    return { placement: 'current', placementWarning: null, reason: 'read-only-current-worktree' }
  }
  if (workspaceKind === 'git') {
    return { placement: 'new-child', placementWarning: null, reason: 'writes-new-child-worktree' }
  }
  // Why: a folder workspace has no worktree to branch, so its writes land in the current folder.
  return {
    placement: 'current',
    placementWarning: 'folder-workspace-writes',
    reason: 'folder-workspace-writes'
  }
}

export function decideDelegation(input: DelegationRouteInput): DelegationRouteResult {
  const { dimensions, tier, riskFloorApplied } = classifyDelegationTask({
    summary: input.summary,
    writesCode: input.writesCode
  })
  const { ranking, winner } = rankDelegationAgents({
    candidates: input.candidates,
    now: input.now,
    parentAgent: input.parentAgent,
    staleAfterMs: input.staleAfterMs
  })
  if (winner === null) {
    return { status: 'no-eligible-agent', tier, dimensions, ranking }
  }

  const agent = winner.usage.agent
  const model = resolveDelegationModel({ agent, tier, catalog: input.catalogs?.[agent] })
  const placement = delegationPlacementFor(input.writesCode, input.workspaceKind)
  const reasons: DelegationReasonCode[] = [winner.reason]
  if (winner.usage.noData) {
    reasons.push('no-usage-data')
  }
  if (riskFloorApplied) {
    reasons.push('high-risk-tier-floor')
  }
  reasons.push(...model.adjustments, placement.reason)

  return {
    status: 'routed',
    decision: {
      agent,
      model: model.model,
      effort: model.effort,
      tier,
      dimensions,
      placement: placement.placement,
      placementWarning: placement.placementWarning,
      ranking,
      reasons
    }
  }
}
