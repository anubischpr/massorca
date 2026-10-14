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

export const MAX_RECORDED_CHILD_TURNS = 32

/** Keep contexts the cursor consumes before their turn notifications arrive. */
export function retainRecordedChildTurnConfigurations(
  records: readonly JsonRecord[],
  configurations: Map<string, RecordedAgentTurnConfiguration>
): void {
  for (const row of records) {
    const turnId = record(row.payload)?.turn_id
    if (row.type !== 'turn_context' || typeof turnId !== 'string') {
      continue
    }
    const previous = configurations.get(turnId)
    const next = readRecordedChildTurnConfiguration([row], turnId, previous)
    if (!next || next.turnId !== turnId || next === previous) {
      continue
    }
    configurations.delete(turnId)
    configurations.set(turnId, next)
    if (configurations.size > MAX_RECORDED_CHILD_TURNS) {
      const oldest = configurations.keys().next().value
      if (oldest !== undefined) {
        configurations.delete(oldest)
      }
    }
  }
}
