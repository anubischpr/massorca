import type {
  SessionOptionDescriptor,
  SessionOptionSelectChoice
} from '../../../src/shared/native-chat-session-options'

type FeaturedRule = (choice: SessionOptionSelectChoice) => boolean

export type ModelSheetSplit = {
  /** The model descriptor limited to the choices shown first, in their own order. */
  featured: SessionOptionDescriptor
  /** The model descriptor limited to the choices behind "More models"; null when none fold away. */
  more: SessionOptionDescriptor | null
  moreCount: number
}

// Each field as lower-case words, padded so a match always spans whole words within that field.
function paddedWords(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
}

// Why: value and label are matched separately, so a phrase can never splice across the two fields.
function hasPhrase(choice: SessionOptionSelectChoice, phrase: string): boolean {
  return [choice.value, choice.label].some((text) => paddedWords(text).includes(phrase))
}

// Claude's 5.5 generation (`Opus 5.5`, `claude-sonnet-5-5`); Fable 5.1 and bare aliases fold away.
const isClaudeFiveFive: FeaturedRule = (choice) => hasPhrase(choice, ' 5 5 ')

// Codex's 6.1 models plus GPT-6 Astra and Luna; GPT-5.6 Luna and GPT-6 Sol fold away.
const isCodexFeatured: FeaturedRule = (choice) =>
  hasPhrase(choice, ' 6 1 ') ||
  hasPhrase(choice, ' gpt 6 astra ') ||
  hasPhrase(choice, ' gpt 6 luna ')

// Antigravity's Gemini 4 Argon and Gemini 3.8 Flash, whichever effort suffix their id carries.
const isAntigravityFeatured: FeaturedRule = (choice) =>
  hasPhrase(choice, ' gemini 4 argon ') || hasPhrase(choice, ' gemini 3 8 flash ')

function featuredRuleFor(agent: string | null): FeaturedRule | null {
  switch (agent) {
    case 'claude':
      return isClaudeFiveFive
    case 'codex':
      return isCodexFeatured
    case 'antigravity':
      return isAntigravityFeatured
    default:
      return null
  }
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

/**
 * Splits a model list for the model sheet. The selected model stays featured at its own place even
 * when the rule would fold it; with no rule, or a rule that matches nothing, nothing folds away.
 */
export function splitModelSheet(
  descriptor: SessionOptionDescriptor,
  agent: string | null
): ModelSheetSplit {
  const rule = featuredRuleFor(agent)
  if (rule === null || descriptor.action !== undefined || descriptor.kind.type !== 'select') {
    return { featured: descriptor, more: null, moreCount: 0 }
  }
  const { choices, currentValue } = descriptor.kind
  if (!choices.some((choice) => rule(choice))) {
    return { featured: descriptor, more: null, moreCount: 0 }
  }
  const isFeatured = (choice: SessionOptionSelectChoice): boolean =>
    rule(choice) || choice.value === currentValue
  const rest = choices.filter((choice) => !isFeatured(choice))
  return {
    featured: withChoices(descriptor, choices.filter(isFeatured)),
    more: rest.length > 0 ? withChoices(descriptor, rest) : null,
    moreCount: rest.length
  }
}
