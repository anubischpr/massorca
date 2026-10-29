// Each entry of a list with a React key that stays unique when two entries read the same, and holds no index:
// the entry's text, and how many equal texts came before it.
export function keyedEntries<Entry>(
  entries: readonly Entry[],
  textOf: (entry: Entry) => string
): { key: string; entry: Entry; index: number }[] {
  const seen = new Map<string, number>()
  return entries.map((entry, index) => {
    const text = textOf(entry)
    const occurrence = seen.get(text) ?? 0
    seen.set(text, occurrence + 1)
    return { key: `${text}\u0000${occurrence}`, entry, index }
  })
}
