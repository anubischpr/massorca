/** Router shapes for delegated sessions; plain JSON so the mobile client can import them too. */

export type DelegationDimensionLevel = 'low' | 'medium' | 'high'

export type DelegationTaskDimensions = {
  risk: DelegationDimensionLevel
  complexity: DelegationDimensionLevel
  /** Higher means the result is easier to verify. */
  verifiability: DelegationDimensionLevel
  ambiguity: DelegationDimensionLevel
}

export type DelegationTier = 1 | 2 | 3 | 4 | 5

export type DelegationUsageWindow = 'session' | 'weekly'

export type DelegationExclusion = 'usage-limit' | 'limit-reached'

export type DelegationAgentUsage = {
  agent: string
  /** The higher known window, or 60 when no fresh window is known. */
  bindingPercent: number
  /** The 5-hour or weekly window that set `bindingPercent`; null when none was known or it was monthly. */
  window: DelegationUsageWindow | null
  /** Set when the monthly allowance set `bindingPercent`; an older client ignores it. */
  monthly?: true
  noData: boolean
  excluded: DelegationExclusion | null
}

export type DelegationPlacement = 'current' | 'new-child'

export type DelegationPlacementWarning = 'folder-workspace-writes'

/** Stable codes; the UI localizes them. */
export type DelegationReasonCode =
  | 'lowest-usage'
  | 'parent-agent-tie'
  | 'fixed-order-tie'
  | 'no-usage-data'
  | 'high-risk-tier-floor'
  | 'model-unavailable'
  | 'effort-clamped'
  | 'read-only-current-worktree'
  | 'writes-new-child-worktree'
  | 'folder-workspace-writes'

export type DelegationDecision = {
  agent: string
  /** Null when the agent's own default model applies. */
  model: string | null
  /** Null when no model is named (the agent's default runs) or no supported effort level remains. */
  effort: string | null
  tier: DelegationTier
  dimensions: DelegationTaskDimensions
  placement: DelegationPlacement
  placementWarning: DelegationPlacementWarning | null
  ranking: DelegationAgentUsage[]
  reasons: DelegationReasonCode[]
}

export type DelegationRouteResult =
  | { status: 'routed'; decision: DelegationDecision }
  | {
      status: 'no-eligible-agent'
      tier: DelegationTier
      dimensions: DelegationTaskDimensions
      ranking: DelegationAgentUsage[]
    }
