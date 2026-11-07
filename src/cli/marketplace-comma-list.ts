/** A comma-separated flag value as trimmed, non-empty entries. */
export function parseCommaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
