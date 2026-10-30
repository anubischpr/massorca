import type {
  SessionOptionDescriptor,
  SessionOptionSelectChoice
} from './native-chat-session-options'
import type { PiRuntimeSelection } from './pi-runtime-selection'

/** A host choice as either picker holds it: the value the host runs, its label and any live description. */
export type FeaturedModelChoice = { value: string; label: string; description?: string }

/** The agents with a featured set. A Pi-protocol agent counts only when it runs Gentle Shell. */
export type FeaturedModelAgent = 'claude' | 'codex' | 'antigravity' | 'gentle-shell'

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

type FeaturedModelSpec = {
  name: string
  version: string
  /** Shown only when the live catalog gives the model no description. */
  description: string
  matches: (choice: FeaturedModelChoice) => boolean
}

// Each field as lower-case words, padded so a phrase spans whole words within that one field.
function paddedWords(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
}

// Why: value and label are matched separately, so a phrase can never splice across the two fields.
function hasPhrase(choice: FeaturedModelChoice, phrase: string): boolean {
  return [choice.value, choice.label].some((text) => paddedWords(text).includes(phrase))
}

const byValue =
  (value: string): ((choice: FeaturedModelChoice) => boolean) =>
  (choice) =>
    choice.value === value

const byPhrase =
  (phrase: string): ((choice: FeaturedModelChoice) => boolean) =>
  (choice) =>
    hasPhrase(choice, phrase)

// Why: ids vary by provider and effort suffix, so phrases match words, not whole ids.
const FEATURED_MODELS: Readonly<Record<FeaturedModelAgent, readonly FeaturedModelSpec[]>> = {
  claude: [
    {
      name: 'Fable',
      version: '5.1',
      description: 'Most capable for the hardest, longest-running tasks',
      matches: byValue('fable')
    },
    {
      name: 'Opus',
      version: '5.5',
      description: 'For complex work and everyday tasks',
      matches: byValue('opus')
    },
    {
      name: 'Sonnet',
      version: '5.5',
      description: 'Efficient for routine tasks',
      matches: byValue('sonnet')
    },
    {
      name: 'Haiku',
      version: '5.5',
      description: 'Fastest for quick answers',
      matches: byValue('haiku')
    }
  ],
  codex: [
    {
      name: 'Astra',
      version: '6',
      description: 'Frontier intelligence for the most demanding work',
      matches: byPhrase(' gpt 6 astra ')
    },
    {
      name: 'Sol',
      version: '6.1',
      description: 'Latest workhorse model for coding and everyday work',
      matches: byPhrase(' gpt 6 1 sol ')
    },
    {
      name: 'Terra',
      version: '6.1',
      description: 'Balanced model for straightforward work',
      matches: byPhrase(' gpt 6 1 terra ')
    },
    {
      name: 'Luna',
      version: '6',
      description: 'Fast and affordable model for easier tasks',
      matches: byPhrase(' gpt 6 luna ')
    }
  ],
  antigravity: [
    {
      name: 'Gemini Argon',
      version: '4',
      description: 'Most capable Gemini for demanding work',
      matches: byPhrase(' gemini 4 argon ')
    },
    {
      name: 'Gemini Flash',
      version: '3.8',
      description: 'Fast Gemini for everyday tasks',
      matches: byPhrase(' gemini 3 8 flash ')
    }
  ],
  'gentle-shell': [
    {
      name: 'DeepSeek Flash',
      version: 'V4',
      description: 'Fast and affordable for everyday coding',
      matches: byPhrase(' deepseek v4 flash ')
    },
    {
      name: 'GLM Flash',
      version: '5.3',
      description: 'Fast and affordable for quick tasks',
      // Why: the Gentle Shell catalog writes GLM ids both as glm-5.3 and glm5.3.
      matches: (choice) =>
        hasPhrase(choice, ' glm 5 3 flash ') || hasPhrase(choice, ' glm5 3 flash ')
    }
  ]
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

/** How one model reads on its own, such as a picker's pill: the featured name, else its label. */
export function featuredModelDisplay(
  choice: FeaturedModelChoice,
  agent: FeaturedModelAgent | null
): FeaturedModelDisplay {
  return displayOf(specFor(agent, choice), choice)
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
    .map((choice) => ({ choice, display: displayOf(undefined, choice) }))
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
