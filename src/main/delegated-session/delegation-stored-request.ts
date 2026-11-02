import { z } from 'zod'
import {
  parseDelegationOptionId,
  readDelegationDecision
} from '../../shared/delegated-session-journal'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from '../../shared/prototype-count-setting'
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

const StoredPrototypeCount = z.object({
  count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX).optional().catch(undefined)
})

/** The prototype count the person answered on the card, or undefined when they picked none. */
export function readStoredPrototypeCount(row: DelegationRequestRow): number | undefined {
  return StoredPrototypeCount.safeParse(parseJson(row.options_json)).data?.count
}

/** The stored options with the answered count added; the agents stay as the card offered them. */
export function storedOptionsWithPrototypeCount(row: DelegationRequestRow, count: number): string {
  return JSON.stringify({ agents: readStoredDelegationAgents(row), count })
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
  const { tier } = classifyDelegationTask({ summary: row.summary, writesCode: writes })
  const { model, effort } = resolveLaunchableDelegationModel({ agent: choice.agent, tier })
  return {
    agent: choice.agent,
    label: labelOf(choice.agent),
    model,
    effort,
    placement: delegationPlacementFor({
      ...row,
      writesCode: writes,
      workspaceKind: row.workspace_kind
    }).placement,
    automatic: false
  }
}
