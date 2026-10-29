import {
  DELEGATION_AUTOMATIC_OPTION_ID,
  delegationAgentOptionId,
  type DelegationCardAgent,
  type DelegationCardPayload
} from '../../../src/shared/delegated-session-journal'
import type {
  DelegationAgentUsage,
  DelegationDecision,
  DelegationDimensionLevel,
  DelegationPlacement,
  DelegationPlacementWarning,
  DelegationReasonCode,
  DelegationTaskDimensions
} from '../../../src/shared/delegated-session-types'

/** The agent-choice card as a question carries it: the payload, and the answer text each option sends. */
export type MobileDelegationQuestion = {
  card: DelegationCardPayload
  /** Keyed by option id (`automatic`, `agent:<id>`); each value is the token the answer path reads. */
  answerTokens: Partial<Record<string, string>>
}

/** One row of the choice card: Automatic, or one agent with its usage. */
export type MobileDelegationOptionRow = {
  optionId: string
  /** The agent this row runs; null for Automatic. */
  agentId: string | null
  label: string
  usageText: string
  /** At or near a limit: the usage text takes the destructive color. */
  excluded: boolean
  /** Bar fill in percent; null when there is no usage to draw. */
  barPercent: number | null
  detail: string
}

/** One ranked agent in the why sheet. */
export type MobileDelegationRankRow = {
  agentId: string
  label: string
  valueText: string
  windowText: string | null
  excluded: boolean
  picked: boolean
}

export type MobileDelegationDimensionCell = { title: string; value: string }

// Why: the same reason codes the desktop card words, so both clients explain one decision alike.
const WINNER_REASON_CODES: readonly DelegationReasonCode[] = [
  'lowest-usage',
  'parent-agent-tie',
  'fixed-order-tie'
]
const TASK_REASON_CODES: readonly DelegationReasonCode[] = ['high-risk-tier-floor']
const MODEL_REASON_CODES: readonly DelegationReasonCode[] = ['model-unavailable', 'effort-clamped']

/** Automatic first when the router has a decision, then every agent in the host's ranking order. */
export function delegationOptionRows(card: DelegationCardPayload): MobileDelegationOptionRow[] {
  const automatic = card.decision ? [automaticRow(card, card.decision)] : []
  return [...automatic, ...card.agents.map(agentRow)]
}

/** Automatic starts selected; without a decision nothing is chosen until the person picks. */
export function defaultDelegationOption(card: DelegationCardPayload): string | null {
  return card.decision ? DELEGATION_AUTOMATIC_OPTION_ID : null
}

export function delegationUsageText(usage: DelegationAgentUsage): string {
  if (usage.excluded === 'limit-reached') {
    return 'Limit reached'
  }
  if (usage.noData) {
    return 'No usage data'
  }
  const used = `${Math.round(usage.bindingPercent)}% used${usage.monthly ? ' this month' : ''}`
  return usage.excluded === 'usage-limit' ? `${used} · near its limit` : used
}

export function delegationBarPercent(usage: DelegationAgentUsage): number | null {
  if (usage.noData || usage.excluded === 'limit-reached') {
    return null
  }
  return Math.min(100, Math.max(0, usage.bindingPercent))
}

export function modelEffortText(model: string | null, effort: string | null): string {
  const name = model ?? 'Default model'
  return effort ? `${name} · ${effort}` : name
}

/** The line under the Automatic row's pick: the agent it chose, with the model and effort it runs. */
export function automaticPickText(
  card: DelegationCardPayload,
  decision: DelegationDecision
): string {
  return `Picks ${agentLabel(card, decision.agent)} · ${modelEffortText(decision.model, decision.effort)}`
}

export function automaticWhyHeading(card: DelegationCardPayload, agentId: string): string {
  return `Why Automatic picked ${agentLabel(card, agentId)}`
}

/** The router's ranking, lowest usage first, with the agent it picked marked. */
export function delegationRankRows(
  card: DelegationCardPayload,
  decision: DelegationDecision
): MobileDelegationRankRow[] {
  return decision.ranking.map((usage) => ({
    agentId: usage.agent,
    label: agentLabel(card, usage.agent),
    valueText: rankValueText(usage),
    windowText: rankWindowText(usage),
    excluded: usage.excluded !== null,
    picked: usage.agent === decision.agent
  }))
}

export function delegationDimensionCells(
  dimensions: DelegationTaskDimensions
): MobileDelegationDimensionCell[] {
  return [
    { title: 'Risk', value: levelText(dimensions.risk) },
    { title: 'Complexity', value: levelText(dimensions.complexity) },
    { title: 'Verifiability', value: levelText(dimensions.verifiability) },
    { title: 'Ambiguity', value: levelText(dimensions.ambiguity) }
  ]
}

export function delegationWinnerLines(decision: DelegationDecision): string[] {
  return reasonLines(decision.reasons, WINNER_REASON_CODES)
}

export function delegationTaskLines(decision: DelegationDecision): string[] {
  return reasonLines(decision.reasons, TASK_REASON_CODES)
}

export function delegationModelLines(decision: DelegationDecision): string[] {
  return reasonLines(decision.reasons, MODEL_REASON_CODES)
}

export function delegationPlacementText(placement: DelegationPlacement): string {
  return placement === 'new-child' ? 'New child worktree' : 'This worktree'
}

/** The placement reason follows from the placement and its warning, so both clients word it alike. */
export function delegationPlacementLines(
  placement: DelegationPlacement,
  warning: DelegationPlacementWarning | null
): string[] {
  const code: DelegationReasonCode =
    warning === 'folder-workspace-writes'
      ? 'folder-workspace-writes'
      : placement === 'new-child'
        ? 'writes-new-child-worktree'
        : 'read-only-current-worktree'
  return textLines([code])
}

function automaticRow(
  card: DelegationCardPayload,
  decision: DelegationDecision
): MobileDelegationOptionRow {
  return {
    optionId: DELEGATION_AUTOMATIC_OPTION_ID,
    agentId: null,
    label: 'Automatic',
    usageText: `Picks ${agentLabel(card, decision.agent)}`,
    excluded: false,
    barPercent: null,
    detail: 'Chooses by usage, then model and effort by task'
  }
}

function agentRow(agent: DelegationCardAgent): MobileDelegationOptionRow {
  return {
    optionId: delegationAgentOptionId(agent.agent),
    agentId: agent.agent,
    label: agent.label,
    usageText: delegationUsageText(agent.usage),
    excluded: agent.usage.excluded !== null,
    barPercent: delegationBarPercent(agent.usage),
    detail: modelEffortText(agent.model, agent.effort)
  }
}

function agentLabel(card: DelegationCardPayload, agentId: string): string {
  return card.agents.find((entry) => entry.agent === agentId)?.label ?? agentId
}

function rankValueText(usage: DelegationAgentUsage): string {
  if (usage.excluded === 'limit-reached') {
    return 'Limit reached'
  }
  if (usage.noData) {
    return 'No data'
  }
  return `${Math.round(usage.bindingPercent)}%`
}

function rankWindowText(usage: DelegationAgentUsage): string | null {
  if (usage.noData) {
    return `Counted as ${Math.round(usage.bindingPercent)}%`
  }
  if (usage.monthly) {
    return 'monthly window'
  }
  if (usage.window === null) {
    return null
  }
  return usage.window === 'session' ? '5h window' : 'weekly window'
}

function levelText(level: DelegationDimensionLevel): string {
  switch (level) {
    case 'low':
      return 'Low'
    case 'medium':
      return 'Medium'
    case 'high':
      return 'High'
  }
}

function reasonLines(
  reasons: readonly DelegationReasonCode[],
  codes: readonly DelegationReasonCode[]
): string[] {
  return textLines(reasons.filter((code) => codes.includes(code)))
}

function textLines(codes: readonly DelegationReasonCode[]): string[] {
  return codes.flatMap((code) => {
    const text = reasonText(code)
    return text ? [text] : []
  })
}

function reasonText(code: DelegationReasonCode): string | undefined {
  switch (code) {
    case 'lowest-usage':
      return 'Lowest usage'
    case 'parent-agent-tie':
      return "Within 5 points of the lowest usage, so the parent's agent wins"
    case 'fixed-order-tie':
      return 'Tied on usage, so the fixed agent order decides'
    case 'high-risk-tier-floor':
      return 'High risk raises the task to tier 4'
    case 'model-unavailable':
      return 'This agent has no model for this tier, so its default runs'
    case 'effort-clamped':
      return 'Effort is lowered to what this agent supports'
    case 'read-only-current-worktree':
      return 'Read-only task, so it runs in this worktree'
    case 'writes-new-child-worktree':
      return 'Writes code, so it gets its own worktree'
    case 'folder-workspace-writes':
      return 'Folder workspace, so writes land in this folder'
    // Shown by the usage line instead of as a reason.
    case 'no-usage-data':
      return undefined
  }
}
