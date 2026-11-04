import type { PrototypeDesignSystemMode } from './prototype-design-system-files'
import { clampPrototypeCount } from './prototype-count-setting'

/** What the person answered on the prototype count card before a room request was posted. */
export type BotTeamPrototypeChoice = { count: number; designSystem?: PrototypeDesignSystemMode }

// Opens the paragraph a task's start notes carry, so it can be found and taken out again.
const CHOICE_LEAD = 'Prototype choice (host only):'
const CHOICE_PATTERN =
  /^Prototype choice \(host only\): count=(\d+)(?: designSystem=(use|propose|skip))?$/

/** The notes with the choice added, replacing any earlier one. */
export function withBotTeamPrototypeChoice(
  notes: string | null | undefined,
  choice: BotTeamPrototypeChoice
): string {
  const line = `${CHOICE_LEAD} count=${clampPrototypeCount(choice.count)}${choice.designSystem ? ` designSystem=${choice.designSystem}` : ''}`
  return [withoutBotTeamPrototypeChoice(notes), line].filter((part) => part !== null).join('\n\n')
}

/** The choice among a task's start notes, or null when it has none. */
export function botTeamPrototypeChoiceIn(
  notes: string | null | undefined
): BotTeamPrototypeChoice | null {
  for (const part of notes?.split('\n\n') ?? []) {
    const match = CHOICE_PATTERN.exec(part)
    if (match?.[1]) {
      const designSystem =
        match[2] === 'use' || match[2] === 'propose' || match[2] === 'skip' ? match[2] : undefined
      return {
        count: clampPrototypeCount(Number(match[1])),
        ...(designSystem ? { designSystem } : {})
      }
    }
  }
  return null
}

/** The notes a bot reads: everything but the choice, null when nothing else is left. */
export function withoutBotTeamPrototypeChoice(notes: string | null | undefined): string | null {
  const rest = (notes?.split('\n\n') ?? []).filter((part) => !part.startsWith(CHOICE_LEAD))
  return rest.length > 0 ? rest.join('\n\n') : null
}
