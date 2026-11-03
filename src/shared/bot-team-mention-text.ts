/** A bot or team the room writes as `@Name`; the stored text stays plain, chips only render it. */
export type BotTeamMentionName = { name: string; kind: 'bot' | 'team' }

export type BotTeamMentionSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; value: string; name: string }

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Why: longest first, so "Ana Lopez" wins over "Ana" at the same position.
function mentionAlternation(names: readonly BotTeamMentionName[]): string | null {
  const sorted = [...new Set(names.map((entry) => entry.name))]
    .filter((name) => name.length > 0)
    .sort((a, b) => b.length - a.length)
  if (sorted.length === 0) {
    return null
  }
  return sorted.map(escapeForPattern).join('|')
}

function canonicalName(names: readonly BotTeamMentionName[], typed: string): string {
  const lower = typed.toLowerCase()
  return names.find((entry) => entry.name.toLowerCase() === lower)?.name ?? typed
}

/** Splits text into plain runs and the known `@Name` mentions in it. */
export function splitBotTeamMentionText(
  text: string,
  names: readonly BotTeamMentionName[]
): BotTeamMentionSegment[] {
  const alternation = mentionAlternation(names)
  if (alternation === null) {
    return [{ kind: 'text', value: text }]
  }
  // Why: the lookbehind keeps a mid-word @ (an address) plain; the lookahead keeps a name that is only a prefix plain.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_@])@(${alternation})(?![\\p{L}\\p{N}_])`, 'giu')
  const segments: BotTeamMentionSegment[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > last) {
      segments.push({ kind: 'text', value: text.slice(last, start) })
    }
    segments.push({ kind: 'mention', value: match[0], name: canonicalName(names, match[1]) })
    last = start + match[0].length
  }
  if (last < text.length) {
    segments.push({ kind: 'text', value: text.slice(last) })
  }
  return segments.length > 0 ? segments : [{ kind: 'text', value: text }]
}

/**
 * Backspace right after a known mention (and the space the picker adds) removes the whole mention;
 * null leaves the key to the textarea.
 */
export function removeBotTeamMentionBeforeCaret(
  text: string,
  caret: number,
  names: readonly BotTeamMentionName[]
): { text: string; caret: number } | null {
  const alternation = mentionAlternation(names)
  if (alternation === null) {
    return null
  }
  const before = text.slice(0, caret)
  const match = new RegExp(`(?<![\\p{L}\\p{N}_@])@(${alternation}) ?$`, 'iu').exec(before)
  if (!match) {
    return null
  }
  const start = match.index
  return { text: text.slice(0, start) + text.slice(caret), caret: start }
}
