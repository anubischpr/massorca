import type { Automation } from '../../../../shared/automations-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { nextAutomationOccurrenceAfter } from '../../../../shared/automation-schedule-occurrences'
import { tryParseAutomationRrule } from '../../../../shared/automation-schedule-parsing'
import {
  getAutomationListTarget,
  listAutomationsForTarget,
  type AutomationHostTarget
} from '../automations/automation-host-client'
import type { CalendarFrequency, CalendarRange, CalendarRun } from './calendar-types'

// An hourly automation would otherwise flood a month with hundreds of entries.
export const MAX_RUNS_PER_AUTOMATION = 100

function automationFrequency(rrule: string): CalendarFrequency {
  return tryParseAutomationRrule(rrule)?.preset ?? 'custom'
}

function occurrencesInRange(automation: Automation, range: CalendarRange): number[] {
  const occurrences: number[] = []
  let cursor = range.from - 1
  while (occurrences.length < MAX_RUNS_PER_AUTOMATION) {
    const next = nextAutomationOccurrenceAfter(automation.rrule, automation.dtstart, cursor)
    if (next >= range.to) {
      break
    }
    occurrences.push(next)
    cursor = next
  }
  return occurrences
}

/** The enabled automations' scheduled runs inside the window, at most MAX_RUNS_PER_AUTOMATION each. */
export function expandAutomationRuns(
  automations: readonly Automation[],
  range: CalendarRange
): CalendarRun[] {
  const runs: CalendarRun[] = []
  for (const automation of automations) {
    if (!automation.enabled) {
      continue
    }
    let occurrences: number[]
    try {
      occurrences = occurrencesInRange(automation, range)
    } catch {
      // An unreadable schedule never runs, so it has nothing to show.
      continue
    }
    const frequency = automationFrequency(automation.rrule)
    for (const at of occurrences) {
      runs.push({
        id: `automation:${automation.id}:${at}`,
        name: automation.name,
        at,
        frequency,
        source: 'automation',
        agentId: automation.agentId
      })
    }
  }
  return runs
}

/** This computer owns local and SSH automations; a selected remote environment owns its own. */
export function calendarAutomationTargets(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined
): AutomationHostTarget[] {
  const active = getAutomationListTarget(settings)
  return active.kind === 'environment' ? [{ kind: 'local' }, active] : [{ kind: 'local' }]
}

/** Lists every target; a host that does not answer leaves the others on screen. */
export async function listCalendarAutomations(
  targets: readonly AutomationHostTarget[],
  list: (target: AutomationHostTarget) => Promise<Automation[]> = listAutomationsForTarget
): Promise<Automation[]> {
  const settled = await Promise.allSettled(targets.map((target) => list(target)))
  const byId = new Map<string, Automation>()
  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      continue
    }
    for (const automation of result.value) {
      if (!byId.has(automation.id)) {
        byId.set(automation.id, automation)
      }
    }
  }
  return [...byId.values()]
}
