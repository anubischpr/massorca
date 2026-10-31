import { z } from 'zod'
import {
  parseDelegationOptionId,
  readDelegationDecision
} from '../../shared/delegated-session-journal'
import { PROTOTYPE_COUNT_MAX, PROTOTYPE_COUNT_MIN } from '../../shared/prototype-count-setting'
import {
  PROTOTYPE_DESIGN_SYSTEM_MODES,
  type PrototypeDesignSystemMode
} from '../../shared/prototype-design-system-files'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { classifyDelegationTask } from './delegation-task-classifier'
import { resolveLaunchableDelegationModel } from './delegation-launch-preferences'
import { delegationPlacementFor } from './delegation-router'
import type { DelegationStoredAgent } from './delegation-options'
import type { DelegationLaunchTarget } from './delegation-launch-types'

export const AUTOMATIC_BRING_BACK_MARKS = [
  'child-finishing',
  'waiting',
  'asked-commit',
  'resolving',
  'merged',
  'undone',
  'notice'
] as const
export type AutomaticBringBackMark = (typeof AUTOMATIC_BRING_BACK_MARKS)[number]

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

const StoredPrototypeAnswers = z.object({
  count: z.int().min(PROTOTYPE_COUNT_MIN).max(PROTOTYPE_COUNT_MAX).optional().catch(undefined),
  designSystem: z.enum(PROTOTYPE_DESIGN_SYSTEM_MODES).optional().catch(undefined)
})

/** The prototype count the person answered on the card, or undefined when they picked none. */
export function readStoredPrototypeCount(row: DelegationRequestRow): number | undefined {
  return StoredPrototypeAnswers.safeParse(parseJson(row.options_json)).data?.count
}

/** The design system choice the person answered on the card, or undefined when the card asked none. */
export function readStoredDesignSystemMode(
  row: DelegationRequestRow
): PrototypeDesignSystemMode | undefined {
  return StoredPrototypeAnswers.safeParse(parseJson(row.options_json)).data?.designSystem
}

const StoredChildGit = z.object({
  childGit: z.object({ branch: z.string().min(1), baseSha: z.string().min(1) })
})

export type StoredChildGit = z.infer<typeof StoredChildGit>['childGit']

/** The child's branch and first commit, recorded at launch; a request older than that has none. */
export function readStoredChildGit(row: DelegationRequestRow): StoredChildGit | undefined {
  return StoredChildGit.safeParse(parseJson(row.options_json)).data?.childGit
}

/** The stored options with the child's git identity added; every other key stays as it is. */
export function storedOptionsWithChildGit(
  row: DelegationRequestRow,
  childGit: StoredChildGit
): string {
  const options = z.record(z.string(), z.unknown()).safeParse(parseJson(row.options_json))
  return JSON.stringify({ ...(options.success ? options.data : {}), childGit })
}

const StoredAutomaticBringBack = z.object({
  automaticBringBack: z.enum(AUTOMATIC_BRING_BACK_MARKS)
})

/** How far automatic bring back got; stored so a restart keeps the notice and the retry. */
export function readStoredAutomaticBringBack(
  row: DelegationRequestRow
): AutomaticBringBackMark | undefined {
  return StoredAutomaticBringBack.safeParse(parseJson(row.options_json)).data?.automaticBringBack
}

export function storedOptionsWithAutomaticBringBack(
  row: DelegationRequestRow,
  automaticBringBack: AutomaticBringBackMark
): string {
  const options = z.record(z.string(), z.unknown()).safeParse(parseJson(row.options_json))
  return JSON.stringify({ ...(options.success ? options.data : {}), automaticBringBack })
}

/** The stored options with the card's prototype answers added; the agents stay as the card offered them. */
export function storedOptionsWithPrototypeAnswers(
  row: DelegationRequestRow,
  answers: { count?: number; designSystem?: PrototypeDesignSystemMode }
): string {
  return JSON.stringify({
    agents: readStoredDelegationAgents(row),
    ...(answers.count === undefined ? {} : { count: answers.count }),
    ...(answers.designSystem === undefined ? {} : { designSystem: answers.designSystem })
  })
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
    placement: delegationPlacementFor(writes, row.workspace_kind).placement,
    automatic: false
  }
}
