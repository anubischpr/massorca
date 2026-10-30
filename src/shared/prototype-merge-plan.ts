import { z } from 'zod'
import { DIRECTION_LETTER_PATTERN, PROTOTYPE_DIRECTION_LETTERS } from './prototype-request-folder'

// The agent's answer to "Suggest a merge of A and C.": the file `merge-plan.json` in the request
// folder, and the review the user edits before sending "Merge into D.".

/** Largest merge-plan.json the host serves and a client parses. */
export const PROTOTYPE_MERGE_PLAN_MAX_BYTES = 64 * 1024
// Why: every section of two directions plus their components, with parts present in one direction only.
export const PROTOTYPE_MERGE_PLAN_PARTS_MAX = 48
const PART_NAME_MAX_LENGTH = 80
const PART_SELECTOR_MAX_LENGTH = 300
const PLAN_ID_MAX_LENGTH = 64

const LetterSchema = z.string().regex(DIRECTION_LETTER_PATTERN)

const SelectorSchema = z.string().trim().min(1).max(PART_SELECTOR_MAX_LENGTH)

export const PrototypeMergePartKindSchema = z.enum(['section', 'component'])
export type PrototypeMergePartKind = z.infer<typeof PrototypeMergePartKindSchema>

export const PrototypeMergePlanPartSchema = z.object({
  name: z.string().trim().min(1).max(PART_NAME_MAX_LENGTH),
  /** Absent means a section, so a plan written before kinds existed reads as sections. */
  kind: PrototypeMergePartKindSchema.optional(),
  /** The part's selector in the `from` direction; a plan written before `selectors` carries only this. */
  selector: SelectorSchema.optional(),
  /** One selector per direction that has the part; a part in one direction has one entry. */
  selectors: z.record(z.string(), SelectorSchema).optional(),
  /** The starred direction the part is taken from. */
  from: LetterSchema
})

export const PrototypeMergePlanSchema = z
  .object({
    /** Echo of the id the request asked for; absent from an agent that left it out. */
    id: z.string().min(1).max(PLAN_ID_MAX_LENGTH).optional(),
    from: z.array(LetterSchema).min(2).max(PROTOTYPE_DIRECTION_LETTERS.length),
    parts: z.array(PrototypeMergePlanPartSchema).min(1).max(PROTOTYPE_MERGE_PLAN_PARTS_MAX)
  })
  .refine((plan) => new Set(plan.from).size === plan.from.length, {
    message: 'A plan names each direction once'
  })
  .refine((plan) => plan.parts.every((part) => plan.from.includes(part.from)), {
    message: 'A part comes from a direction the plan merges'
  })
  .refine(
    (plan) =>
      plan.parts.every((part) => (part.selectors?.[part.from] ?? part.selector) !== undefined),
    { message: 'A part has a selector in the direction it comes from' }
  )

export type PrototypeMergePlan = z.infer<typeof PrototypeMergePlanSchema>

/** The plan in merge-plan.json, or null when the text is oversized, not JSON, or not a valid plan. */
export function parsePrototypeMergePlan(text: string): PrototypeMergePlan | null {
  if (text.length > PROTOTYPE_MERGE_PLAN_MAX_BYTES) {
    return null
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = PrototypeMergePlanSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** One part of the review: the plan's suggestion, and what the user chose over it. */
export type PrototypeMergeReviewPart = {
  /** The part's place in the plan; stable while the review is open. */
  id: number
  name: string
  kind: PrototypeMergePartKind
  /** The part's selector in each direction that has it; its letters are the part's possible sources. */
  selectors: Readonly<Record<string, string>>
  /** The selector of the suggested source; the phone sheet reads this until it reads `selectors`. */
  selector: string
  suggested: string
  from: string
  on: boolean
}

/**
 * A merge in progress. `waiting`: the plan has not arrived; `baseline` is the plan file's text at the
 * request, which an answer without an id must differ from. It is absent until that text is read, and
 * no file answers the request before then.
 */
export type PrototypeMergeState =
  | {
      phase: 'waiting'
      letters: readonly string[]
      planId: string
      baseline?: string | null
      /** The Layout the user had when the merge started; a sent merge returns to it. */
      layoutBefore?: 'set' | 'focus'
    }
  | {
      phase: 'review'
      letters: readonly string[]
      parts: readonly PrototypeMergeReviewPart[]
      note: string
      sending: boolean
      layoutBefore?: 'set' | 'focus'
    }

/** The merged direction a send asked for, until it shows up in the set. */
export type PrototypeMergeInto = {
  letter: string
  from: readonly string[]
}

function sameLetters(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().join('') === [...right].sort().join('')
}

/**
 * Whether a plan read from the file answers this request: it merges exactly the starred directions,
 * and carries the request's id, or, from an agent that left the id out, differs from the file that
 * was there before the request.
 */
export function isPlanForRequest(
  plan: PrototypeMergePlan,
  text: string,
  request: { letters: readonly string[]; planId: string; baseline?: string | null }
): boolean {
  // Why: until the baseline is read the request is not out, so no file can answer it yet.
  if (request.baseline === undefined || !sameLetters(plan.from, request.letters)) {
    return false
  }
  return plan.id === undefined ? text !== request.baseline : plan.id === request.planId
}

/** The review's parts: each one kept, from the source the plan suggested. */
export function reviewPartsOf(plan: PrototypeMergePlan): PrototypeMergeReviewPart[] {
  return plan.parts.map((part, id) => {
    // A plan without `selectors` has one selector, taken to fit every merged direction.
    const entries =
      part.selectors === undefined
        ? plan.from.map((letter): [string, string | undefined] => [letter, part.selector])
        : plan.from.map((letter): [string, string | undefined] => [
            letter,
            part.selectors?.[letter] ?? (letter === part.from ? part.selector : undefined)
          ])
    const selectors: Record<string, string> = {}
    for (const [letter, selector] of entries) {
      if (selector !== undefined) {
        selectors[letter] = selector
      }
    }
    return {
      id,
      name: part.name,
      kind: part.kind ?? 'section',
      selectors,
      selector: selectors[part.from] ?? '',
      suggested: part.from,
      from: part.from,
      on: true
    }
  })
}

/** The selector of the direction the part is taken from. */
export function chosenSelectorOf(part: PrototypeMergeReviewPart): string {
  return part.selectors[part.from] ?? part.selector
}

/** `no preview` is the renderer's: the selector did not match in the composed preview. */
export type PrototypeMergeMark = 'suggested' | 'changed' | 'left out' | 'only in' | 'no preview'

export function mergeMarkOf(
  part: PrototypeMergeReviewPart,
  placement: 'placed' | 'unmatched' = 'placed'
): PrototypeMergeMark {
  if (!part.on) {
    return 'left out'
  }
  if (placement === 'unmatched') {
    return 'no preview'
  }
  if (Object.keys(part.selectors).length === 1) {
    return 'only in'
  }
  return part.from === part.suggested ? 'suggested' : 'changed'
}

/** The parts the merge keeps, each with the direction it comes from. */
export function keptMergeParts(
  parts: readonly PrototypeMergeReviewPart[]
): readonly PrototypeMergeReviewPart[] {
  return parts.filter((part) => part.on)
}

/** The letter after the highest one the set has; the first gap when the set reaches Z; null when full. */
export function nextFreeDirectionLetter(letters: readonly string[]): string | null {
  const taken = new Set(letters)
  const highest = letters.reduce(
    (best, letter) => Math.max(best, PROTOTYPE_DIRECTION_LETTERS.indexOf(letter)),
    -1
  )
  const after = PROTOTYPE_DIRECTION_LETTERS.charAt(highest + 1)
  if (after !== '' && !taken.has(after)) {
    return after
  }
  return [...PROTOTYPE_DIRECTION_LETTERS].find((letter) => !taken.has(letter)) ?? null
}
