import type {
  SessionOptionDescriptor,
  SessionOptionSelectChoice
} from './native-chat-session-options'
import type { PiRuntimeSelection } from './pi-runtime-selection'
import {
  FEATURED_MODELS,
  FOLDED_MODELS,
  type FeaturedModelAgent,
  type FeaturedModelChoice,
  type FeaturedModelSpec
} from './native-chat-featured-model-catalog'

export type { FeaturedModelAgent, FeaturedModelChoice } from './native-chat-featured-model-catalog'

/** How one model reads: its name alone, and a detail line ("version · description", or the description). */
export type FeaturedModelDisplay = { name: string; detail?: string | undefined }

export type FeaturedModelRow<T extends FeaturedModelChoice> = {
  choice: T
  display: FeaturedModelDisplay
}

export type FeaturedModelSplit<T extends FeaturedModelChoice> = {
  /** Featured models in the set's order, then the selected model when it folds. */
  featured: FeaturedModelRow<T>[]
  /** Everything else, in the host's order, behind "More models". */
  more: FeaturedModelRow<T>[]
}

/** The featured set an agent's picker uses, or null when that agent folds nothing. */
export function featuredModelAgentFor(
  agent: string | null,
  piRuntime?: PiRuntimeSelection | 'unknown'
): FeaturedModelAgent | null {
  switch (agent) {
    case 'claude':
      return 'claude'
    case 'codex':
      return 'codex'
    case 'antigravity':
      return 'antigravity'
    case 'pi':
      return piRuntime === 'gentle-shell' ? 'gentle-shell' : null
    default:
      return null
  }
}

function specFor(
  agent: FeaturedModelAgent | null,
  choice: FeaturedModelChoice
): FeaturedModelSpec | undefined {
  return agent === null ? undefined : FEATURED_MODELS[agent].find((spec) => spec.matches(choice))
}

function foldedSpecFor(
  agent: FeaturedModelAgent | null,
  choice: FeaturedModelChoice
): FeaturedModelSpec | undefined {
  return agent === null ? undefined : FOLDED_MODELS[agent].find((spec) => spec.matches(choice))
}

// Why: only a trailing " <version>" splits, so an unfamiliar label reads whole rather than garbled.
const TRAILING_VERSION = /^(.*[A-Za-z].*?)\s+(\d+(?:\.\d+)*[A-Za-z]?)$/

function splitTrailingVersion(label: string): { name: string; version: string } | undefined {
  const match = TRAILING_VERSION.exec(label.trim())
  return match ? { name: match[1], version: match[2] } : undefined
}

function detailOf(parts: readonly (string | undefined)[]): string | undefined {
  const text = parts
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' · ')
  return text.length > 0 ? text : undefined
}

function displayOf(
  spec: FeaturedModelSpec | undefined,
  choice: FeaturedModelChoice
): FeaturedModelDisplay {
  if (!spec) {
    return { name: choice.label, detail: detailOf([choice.description]) }
  }
  return {
    name: spec.name,
    detail: detailOf([spec.version, choice.description || spec.description])
  }
}

/** A folded model reads as its prototype name, else its label split at a trailing version, else whole. */
function unfeaturedDisplayOf(
  agent: FeaturedModelAgent | null,
  choice: FeaturedModelChoice
): FeaturedModelDisplay {
  const spec = foldedSpecFor(agent, choice)
  if (spec) {
    return displayOf(spec, choice)
  }
  const split = agent === null ? undefined : splitTrailingVersion(choice.label)
  if (split) {
    return { name: split.name, detail: detailOf([split.version, choice.description]) }
  }
  return displayOf(undefined, choice)
}

/** How one model reads alone, such as a picker's pill: its featured or folded name, else its label. */
export function featuredModelDisplay(
  choice: FeaturedModelChoice,
  agent: FeaturedModelAgent | null
): FeaturedModelDisplay {
  const spec = specFor(agent, choice)
  return spec ? displayOf(spec, choice) : unfeaturedDisplayOf(agent, choice)
}

/**
 * Splits a model list into the featured set and the rest that folds. The selected model always
 * stays in the main list. Returns null, folding nothing, when the agent has no featured set or
 * none of its choices match one.
 */
export function splitFeaturedModels<T extends FeaturedModelChoice>(
  choices: readonly T[],
  agent: FeaturedModelAgent | null,
  currentValue?: string
): FeaturedModelSplit<T> | null {
  if (agent === null || !choices.some((choice) => specFor(agent, choice) !== undefined)) {
    return null
  }
  const featured: FeaturedModelRow<T>[] = []
  const featuredChoices = new Set<T>()
  for (const spec of FEATURED_MODELS[agent]) {
    for (const choice of choices.filter((candidate) => spec.matches(candidate))) {
      featuredChoices.add(choice)
      featured.push({ choice, display: displayOf(spec, choice) })
    }
  }
  // Why: the selected model stays in the main list after the featured set, as the prototype promotes it.
  for (const choice of choices) {
    if (choice.value === currentValue && !featuredChoices.has(choice)) {
      featured.push({ choice, display: featuredModelDisplay(choice, agent) })
    }
  }
  const more = choices
    .filter((choice) => !featuredChoices.has(choice) && choice.value !== currentValue)
    .map((choice) => ({ choice, display: unfeaturedDisplayOf(agent, choice) }))
  return { featured, more }
}

export type ModelSheetSplit = {
  /** The model descriptor limited to the choices shown first, with each choice read as its display form. */
  featured: SessionOptionDescriptor
  /** The model descriptor limited to the choices behind "More models"; null when none fold away. */
  more: SessionOptionDescriptor | null
  moreCount: number
}

function withChoices(
  descriptor: SessionOptionDescriptor,
  choices: SessionOptionSelectChoice[]
): SessionOptionDescriptor {
  if (descriptor.kind.type !== 'select') {
    return descriptor
  }
  return { ...descriptor, kind: { ...descriptor.kind, choices } }
}

function displayChoice(
  row: FeaturedModelRow<SessionOptionSelectChoice>
): SessionOptionSelectChoice {
  return {
    ...row.choice,
    label: row.display.name,
    ...(row.display.detail ? { description: row.display.detail } : {})
  }
}

/** A model descriptor split for the sheet; a descriptor with no featured split passes through unchanged. */
export function splitModelSheet(
  descriptor: SessionOptionDescriptor,
  agent: FeaturedModelAgent | null
): ModelSheetSplit {
  if (descriptor.action !== undefined || descriptor.kind.type !== 'select') {
    return { featured: descriptor, more: null, moreCount: 0 }
  }
  const { choices, currentValue } = descriptor.kind
  const split = splitFeaturedModels(choices, agent, currentValue)
  if (split === null) {
    return { featured: descriptor, more: null, moreCount: 0 }
  }
  const more = split.more.map((row) => displayChoice(row))
  return {
    featured: withChoices(
      descriptor,
      split.featured.map((row) => displayChoice(row))
    ),
    more: more.length > 0 ? withChoices(descriptor, more) : null,
    moreCount: more.length
  }
}
