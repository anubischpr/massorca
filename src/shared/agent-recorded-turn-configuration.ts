export type RecordedAgentTurnConfiguration = {
  source: 'recorded-turn-context'
  turnId: string
  observedAt: number
  model?: string
  effort?: string
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256
    ? value.trim()
    : undefined
}

/** Unknown sources never acquire the authority of the child's own recorded turn. */
export function readRecordedAgentTurnConfiguration(
  value: unknown
): RecordedAgentTurnConfiguration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const row = Object.fromEntries(Object.entries(value))
  const turnId = text(row.turnId)
  if (
    row.source !== 'recorded-turn-context' ||
    !turnId ||
    typeof row.observedAt !== 'number' ||
    !Number.isFinite(row.observedAt) ||
    row.observedAt < 0
  ) {
    return null
  }
  const model = text(row.model)
  const effort = text(row.effort)
  return {
    source: row.source,
    turnId,
    observedAt: row.observedAt,
    ...(model ? { model } : {}),
    ...(effort ? { effort } : {})
  }
}
