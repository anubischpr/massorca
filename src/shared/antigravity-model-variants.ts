import type { AgentSessionModelOption } from './agent-session-wire'

/** agy lists one model id per effort (`gemini-4-argon-high`); the picker shows the model once. */
const EFFORT_ORDER = ['low', 'medium', 'high'] as const
const EFFORT_SUFFIX = /^(.+)-(low|medium|high)$/
const LABEL_EFFORT_SUFFIX = /^(.+?)\s*\((?:low|medium|high)\)$/i

type ListedModel = { id: string; label: string }

/** The model an agy id names without its effort, and that effort when the id carries one. */
export function splitAntigravityModelId(id: string): { base: string; effort?: string } {
  const match = EFFORT_SUFFIX.exec(id)
  return match ? { base: match[1]!, effort: match[2]! } : { base: id }
}

/** The agy id of a variant-listed model at an effort; any other model id is returned as given. */
export function antigravityModelIdAtEffort(id: string, effort: string | undefined): string {
  const { base, effort: own } = splitAntigravityModelId(id)
  return own && effort && EFFORT_ORDER.some((known) => known === effort) ? `${base}-${effort}` : id
}

/**
 * One row per base model, with the efforts agy lists for it. The row id is the variant at the
 * model's default effort (medium when listed), so it is itself a valid agy id and an older client
 * that sends it still launches. A model agy lists without an effort variant stays as listed.
 */
export function groupAntigravityModelVariants(
  listed: readonly (ListedModel & Partial<AgentSessionModelOption>)[]
): AgentSessionModelOption[] {
  const groups = new Map<string, { label: string; efforts: Set<string> }>()
  const order: (string | AgentSessionModelOption)[] = []
  for (const model of listed) {
    const { base, effort } = splitAntigravityModelId(model.id)
    // A row grouped earlier names no effort in its label; a catalog saved before grouping does.
    const grouped = model.efforts !== undefined && !LABEL_EFFORT_SUFFIX.test(model.label)
    if (!effort || grouped) {
      order.push({
        id: model.id,
        label: model.label,
        isDefault: model.isDefault ?? false,
        efforts: model.efforts ?? EFFORT_ORDER.map((value) => ({ value, label: value })),
        ...(model.defaultEffort ? { defaultEffort: model.defaultEffort } : {})
      })
      continue
    }
    let group = groups.get(base)
    if (!group) {
      group = {
        label: LABEL_EFFORT_SUFFIX.exec(model.label)?.[1] ?? model.label,
        efforts: new Set()
      }
      groups.set(base, group)
      order.push(base)
    }
    group.efforts.add(effort)
  }
  // The options read lists the current model when the catalog does not; once its model is grouped that row is a duplicate.
  const listedBases = new Set(groups.keys())
  for (const entry of order) {
    if (typeof entry !== 'string' && entry.efforts.length > 0) {
      listedBases.add(splitAntigravityModelId(entry.id).base)
    }
  }
  const kept = order.filter(
    (entry) =>
      typeof entry === 'string' ||
      entry.efforts.length > 0 ||
      !listedBases.has(splitAntigravityModelId(entry.id).base)
  )
  return kept.map((entry) => {
    if (typeof entry !== 'string') {
      return entry
    }
    const group = groups.get(entry)!
    const efforts = EFFORT_ORDER.filter((value) => group.efforts.has(value))
    const defaultEffort = efforts.includes('medium') ? 'medium' : efforts[0]!
    return {
      id: `${entry}-${defaultEffort}`,
      label: group.label,
      isDefault: false,
      defaultEffort,
      efforts: efforts.map((value) => ({ value, label: value }))
    }
  })
}

/** The picker's model and effort for a stored pick: the row's id, and the effort the id or pick names. */
export function antigravitySelectionForPicker(
  model: string | undefined,
  effort: string | undefined,
  rows: readonly AgentSessionModelOption[]
): { model?: string; effort?: string } {
  if (!model) {
    return effort ? { effort } : {}
  }
  const { base, effort: own } = splitAntigravityModelId(model)
  const row = own
    ? rows.find((entry) => splitAntigravityModelId(entry.id).base === base)
    : undefined
  const chosen = effort ?? own
  const supported = row?.efforts.some((entry) => entry.value === chosen) ?? true
  return {
    model: row?.id ?? model,
    ...(chosen && supported
      ? { effort: chosen }
      : row?.defaultEffort
        ? { effort: row.defaultEffort }
        : {})
  }
}
