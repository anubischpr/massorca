// Gentle Shell asks a multi-select question as repeated `select` rounds: each round lists every
// option as `[ ] label` / `[x] label` plus a trailing `Done`, and picking a row toggles it.
const DONE_ROW = 'Done'
const TOGGLE_ROW = /^\[( |x)\] ([\s\S]+)$/

export type ToggleRound = { labels: string[]; checked: boolean[] }

/** What the host still has to toggle after the first pick, answered without asking the user again. */
export type ToggleScript = { title: string; ticked: Set<string>; remaining: string[] }

export function parseToggleRound(options: readonly string[]): ToggleRound | null {
  if (options.length < 3 || options.at(-1) !== DONE_ROW) {
    return null
  }
  const labels: string[] = []
  const checked: boolean[] = []
  for (const row of options.slice(0, -1)) {
    const match = TOGGLE_ROW.exec(row)
    if (!match?.[2]) {
      return null
    }
    labels.push(match[2])
    checked.push(match[1] === 'x')
  }
  return { labels, checked }
}

/** The reply to the script's next round, or null when this is not that round (the script is spent). */
export function nextToggleReply(
  script: ToggleScript,
  title: string,
  options: readonly string[]
): { value: string; last: boolean } | null {
  const round = title === script.title ? parseToggleRound(options) : null
  if (!round) {
    return null
  }
  const checkedLabels = round.labels.filter((_label, index) => round.checked[index])
  if (
    checkedLabels.length !== script.ticked.size ||
    !checkedLabels.every((label) => script.ticked.has(label))
  ) {
    return null
  }
  const label = script.remaining.shift()
  if (label === undefined) {
    return { value: DONE_ROW, last: true }
  }
  const index = round.labels.indexOf(label)
  const row = options[index]
  if (row === undefined || round.checked[index]) {
    return null
  }
  script.ticked.add(label)
  return { value: row, last: false }
}
