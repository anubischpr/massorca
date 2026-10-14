import { record, type JsonRecord } from './codex-rollout-jsonl-cursor'
import {
  readRecordedAgentTurnConfiguration,
  type RecordedAgentTurnConfiguration
} from './agent-recorded-turn-configuration'

export function readRecordedChildTurnConfiguration(
  records: readonly JsonRecord[],
  turnId: string,
  previous: RecordedAgentTurnConfiguration | null = null
): RecordedAgentTurnConfiguration | null {
  let current = previous?.turnId === turnId ? previous : null
  for (const row of records) {
    const payload = record(row.payload)
    if (row.type !== 'turn_context' || payload?.turn_id !== turnId) {
      continue
    }
    const at = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : Number.NaN
    const next = readRecordedAgentTurnConfiguration({
      source: 'recorded-turn-context',
      turnId,
      observedAt: at,
      model: Object.hasOwn(payload, 'model') ? payload.model : current?.model,
      effort: Object.hasOwn(payload, 'effort') ? payload.effort : current?.effort
    })
    if (next && (!current || next.observedAt >= current.observedAt)) {
      current = next
    }
  }
  return current
}
