import { z } from 'zod'
import {
  parseDelegationOptionId,
  readDelegationDecision
} from '../../shared/delegated-session-journal'
import type { DelegationTier } from '../../shared/delegated-session-types'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { classifyDelegationTask } from './delegation-task-classifier'
import { resolveLaunchableDelegationModel } from './delegation-launch-preferences'
import { delegationPlacementFor } from './delegation-router'
import type { DelegationStoredAgent } from './delegation-options'
import type { DelegationLaunchTarget } from './delegation-launch-types'

const StoredOptions = z.object({
  agents: z.array(
    z.object({
      agent: z.string().min(1),
      label: z.string(),
      piRuntime: z.enum(['pi', 'gentle-shell']).optional()
    })
  )
})

function parseJson(text: string | null): unknown {
  if (text === null) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** The agents the card offered, as stored with the request. */
export function readStoredDelegationAgents(row: DelegationRequestRow): DelegationStoredAgent[] {
  const parsed = StoredOptions.safeParse(parseJson(row.options_json))
  return parsed.success ? parsed.data.agents : []
}

/** The tier Jev chose when the card was filed, so an answer neither pays again nor drifts from the card. */
export function readStoredAdvisedTier(row: DelegationRequestRow): { advisedTier?: DelegationTier } {
  const decision = readDelegationDecision(parseJson(row.decision_json))
  return decision?.tierAdvisedBy === 'jev' ? { advisedTier: decision.tier } : {}
}

/** What the request starts, from its choice: Automatic's stored decision, or the picked agent's tier row. */
export function resolveDelegationTarget(row: DelegationRequestRow): DelegationLaunchTarget | null {
  const choice = parseDelegationOptionId(row.choice ?? '')
  if (!choice) {
    return null
  }
  const agents = readStoredDelegationAgents(row)
  const labelOf = (agent: string): string =>
    agents.find((entry) => entry.agent === agent)?.label ?? agent
  if (choice.kind === 'automatic') {
    const decision = readDelegationDecision(parseJson(row.decision_json))
    return decision
      ? {
          agent: decision.agent,
          label: labelOf(decision.agent),
          model: decision.model,
          effort: decision.model === null ? null : decision.effort,
          placement: decision.placement,
          automatic: true
        }
      : null
  }
  const writes = row.writes === 1
  const tier =
    readStoredAdvisedTier(row).advisedTier ??
    classifyDelegationTask({ summary: row.summary, writesCode: writes }).tier
  const { model, effort } = resolveLaunchableDelegationModel({ agent: choice.agent, tier })
  return {
    agent: choice.agent,
    label: labelOf(choice.agent),
    model,
    effort,
    placement: delegationPlacementFor(writes, row.workspace_kind).placement,
    automatic: false
  }
}
