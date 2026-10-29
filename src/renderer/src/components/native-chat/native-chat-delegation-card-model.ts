import { translate } from '@/i18n/i18n'
import {
  DELEGATION_AUTOMATIC_OPTION_ID,
  delegationAgentOptionId,
  type DelegationCardAgent,
  type DelegationCardPayload
} from '../../../../shared/delegated-session-journal'
import type {
  DelegationAgentUsage,
  DelegationDecision,
  DelegationDimensionLevel,
  DelegationPlacement,
  DelegationPlacementWarning,
  DelegationReasonCode,
  DelegationTaskDimensions,
  DelegationUsageWindow
} from '../../../../shared/delegated-session-types'

/** One row of the agent-choice card: Automatic, or one agent with its usage. */
export type DelegationOptionRow = {
  optionId: string
  /** The agent this row runs; null for Automatic. */
  agentId: string | null
  label: string
  usageText: string
  /** At or near a limit: the usage line takes the destructive color. */
  excluded: boolean
  /** Fill of the usage bar in percent; null when there is no usage to draw. */
  barPercent: number | null
  detail: string
}

/** One labelled fact in the "why" detail under the card. */
export type DelegationFact = {
  title: string
  value: string
  /** Model and effort ids are set in mono type. */
  mono: boolean
  lines: string[]
}

const WINNER_REASONS: readonly DelegationReasonCode[] = [
  'lowest-usage',
  'parent-agent-tie',
  'fixed-order-tie'
]

function t(key: string, fallback: string, options?: Record<string, string | number>): string {
  return translate(`components.native-chat.delegation.${key}`, fallback, options)
}

/** Automatic first when the router has a decision, then every agent in the host's ranking order. */
export function delegationOptionRows(card: DelegationCardPayload): DelegationOptionRow[] {
  const automatic = card.decision ? [automaticRow(card, card.decision)] : []
  return [...automatic, ...card.agents.map(agentRow)]
}

/** Automatic starts selected; without a decision nothing is chosen until the person picks. */
export function defaultDelegationOption(card: DelegationCardPayload): string | null {
  return card.decision ? DELEGATION_AUTOMATIC_OPTION_ID : null
}

export function delegationUsageText(usage: DelegationAgentUsage): string {
  if (usage.excluded === 'limit-reached') {
    return t('limitReached', 'Limit reached')
  }
  if (usage.noData) {
    return t('noUsageData', 'No usage data')
  }
  const used = t('usedPercent', '{{percent}}% used', { percent: Math.round(usage.bindingPercent) })
  return usage.excluded === 'usage-limit'
    ? t('nearLimit', '{{used}} · near its limit', { used })
    : used
}

export function delegationBarPercent(usage: DelegationAgentUsage): number | null {
  if (usage.noData || usage.excluded === 'limit-reached') {
    return null
  }
  return Math.min(100, Math.max(0, usage.bindingPercent))
}

export function modelEffortText(model: string | null, effort: string | null): string {
  const name = model ?? t('defaultModel', 'Default model')
  return effort ? `${name} · ${effort}` : name
}

export function delegationAutomaticFacts(
  card: DelegationCardPayload,
  decision: DelegationDecision
): DelegationFact[] {
  const usage = decision.ranking.find((entry) => entry.agent === decision.agent)
  return [
    {
      title: t('agent', 'Agent'),
      value: agentLabel(card, decision.agent),
      mono: false,
      lines: [...reasonLines(decision.reasons, WINNER_REASONS), ...(usage ? usageLines(usage) : [])]
    },
    {
      title: t('task', 'Task'),
      value: t('tier', 'Tier {{tier}} of 5', { tier: decision.tier }),
      mono: false,
      lines: [
        dimensionsLine(decision.dimensions),
        ...reasonLines(decision.reasons, ['high-risk-tier-floor'])
      ]
    },
    {
      title: t('modelEffort', 'Model · effort'),
      value: modelEffortText(decision.model, decision.effort),
      mono: true,
      lines: reasonLines(decision.reasons, ['model-unavailable', 'effort-clamped'])
    },
    {
      title: t('runsIn', 'Runs in'),
      value: placementText(decision.placement),
      mono: false,
      lines: placementLines(decision.placement, decision.placementWarning)
    }
  ]
}

/** The facts a person can check for one agent they picked; the router's reasons are Automatic's alone. */
export function delegationManualFacts(
  card: DelegationCardPayload,
  agent: DelegationCardAgent
): DelegationFact[] {
  return [
    {
      title: t('modelEffort', 'Model · effort'),
      value: modelEffortText(agent.model, agent.effort),
      mono: true,
      lines: []
    },
    {
      title: t('runsIn', 'Runs in'),
      value: placementText(card.placement),
      mono: false,
      lines: placementLines(card.placement, card.placementWarning)
    }
  ]
}

export function automaticPickedHeading(card: DelegationCardPayload, agentId: string): string {
  return t('automaticPicked', 'Automatic picked {{agent}}', { agent: agentLabel(card, agentId) })
}

function automaticRow(
  card: DelegationCardPayload,
  decision: DelegationDecision
): DelegationOptionRow {
  return {
    optionId: DELEGATION_AUTOMATIC_OPTION_ID,
    agentId: null,
    label: t('automatic', 'Automatic'),
    usageText: t('picks', 'Picks {{agent}}', { agent: agentLabel(card, decision.agent) }),
    excluded: false,
    barPercent: null,
    detail: t('automaticDetail', 'Chooses by usage, then model and effort by task')
  }
}

function agentRow(agent: DelegationCardAgent): DelegationOptionRow {
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

function usageLines(usage: DelegationAgentUsage): string[] {
  const percent = Math.round(usage.bindingPercent)
  if (usage.noData) {
    return [t('countedAs', 'No usage data, counted as {{percent}}%', { percent })]
  }
  if (usage.window === null) {
    return [t('usedPercent', '{{percent}}% used', { percent })]
  }
  return [
    t('usedFromWindow', '{{percent}}% used, from the {{window}} window', {
      percent,
      window: windowText(usage.window)
    })
  ]
}

function windowText(window: DelegationUsageWindow): string {
  return window === 'session' ? t('fiveHour', '5h') : t('weekly', 'weekly')
}

function dimensionsLine(dimensions: DelegationTaskDimensions): string {
  return t(
    'dimensions',
    'Risk {{risk}} · Complexity {{complexity}} · Verifiability {{verifiability}} · Ambiguity {{ambiguity}}',
    {
      risk: levelText(dimensions.risk),
      complexity: levelText(dimensions.complexity),
      verifiability: levelText(dimensions.verifiability),
      ambiguity: levelText(dimensions.ambiguity)
    }
  )
}

function levelText(level: DelegationDimensionLevel): string {
  switch (level) {
    case 'low':
      return t('levelLow', 'Low')
    case 'medium':
      return t('levelMedium', 'Medium')
    case 'high':
      return t('levelHigh', 'High')
  }
}

function placementText(placement: DelegationPlacement): string {
  return placement === 'new-child'
    ? t('newChildWorktree', 'New child worktree')
    : t('thisWorktree', 'This worktree')
}

/** The placement reason follows from the placement and its warning, so both boxes word it alike. */
function placementLines(
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
      return t('lowestUsage', 'Lowest usage')
    case 'parent-agent-tie':
      return t('parentAgentTie', "Within 5 points of the lowest usage, so the parent's agent wins")
    case 'fixed-order-tie':
      return t('fixedOrderTie', 'Tied on usage, so the fixed agent order decides')
    case 'high-risk-tier-floor':
      return t('riskFloor', 'High risk raises the task to tier 4')
    case 'model-unavailable':
      return t('modelUnavailable', 'This agent has no model for this tier, so its default runs')
    case 'effort-clamped':
      return t('effortClamped', 'Effort is lowered to what this agent supports')
    case 'read-only-current-worktree':
      return t('readOnly', 'Read-only task, so it runs in this worktree')
    case 'writes-new-child-worktree':
      return t('writes', 'Writes code, so it gets its own worktree')
    case 'folder-workspace-writes':
      return t('folderWrites', 'Folder workspace, so writes land in this folder')
    // Shown by the usage line instead of as a reason.
    case 'no-usage-data':
      return undefined
  }
}
