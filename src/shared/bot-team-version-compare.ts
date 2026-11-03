import { diffLines } from 'diff'

export type BotTeamCompareRow = {
  /** The current line; null where the earlier version had a line the current text lost. */
  left: string | null
  /** The earlier line; null where the current text added one. */
  right: string | null
  change: 'added' | 'removed' | 'changed' | null
  /** Position among the changes, for stepping from one to the next. */
  index: number | null
}

function linesOf(text: string): string[] {
  const normal = text.replace(/\r\n/g, '\n').replace(/\n$/, '')
  return normal === '' ? [] : normal.split('\n')
}

/** The lines of a diff part, whose every line ends in a newline: a blank line stays a line. */
function partLines(value: string): string[] {
  return value === '' ? [] : value.replace(/\n$/, '').split('\n')
}

/** Lines side by side: the current text against an earlier version of the same file. */
export function compareBotTeamTexts(
  current: string,
  earlier: string
): { rows: BotTeamCompareRow[]; changes: number } {
  const rows: BotTeamCompareRow[] = []
  let changes = 0
  const push = (left: string | null, right: string | null, change: BotTeamCompareRow['change']) => {
    rows.push({ left, right, change, index: change === null ? null : changes })
    if (change !== null) {
      changes += 1
    }
  }
  // Every line ends in a newline, so a last line can match a middle line of the other text.
  const withEnds = (text: string): string =>
    linesOf(text)
      .map((line) => `${line}\n`)
      .join('')
  const parts = diffLines(withEnds(earlier), withEnds(current))
  for (let at = 0; at < parts.length; at += 1) {
    const part = parts[at]
    if (!part.added && !part.removed) {
      partLines(part.value).forEach((line) => push(line, line, null))
      continue
    }
    // A removal followed by an addition is one edit; any excess on either side is a plain add or remove.
    const removed = part.removed ? partLines(part.value) : []
    const next = parts[at + 1]
    const added = part.added ? partLines(part.value) : next?.added ? partLines(next.value) : []
    if (part.removed && next?.added) {
      at += 1
    }
    const paired = Math.min(removed.length, added.length)
    for (let line = 0; line < paired; line += 1) {
      push(added[line], removed[line], 'changed')
    }
    added.slice(paired).forEach((line) => push(line, null, 'added'))
    removed.slice(paired).forEach((line) => push(null, line, 'removed'))
  }
  return { rows, changes }
}
