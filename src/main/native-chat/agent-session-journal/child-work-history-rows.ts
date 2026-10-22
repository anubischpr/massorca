// A chat's finished child work (subagents, background commands, monitors) in the host's chat
// database, so the history the Subagents and Background tasks cards show outlives the in-memory
// status store: it is read when a chat is first looked at after the host starts.

import type Database from '../../sqlite/sync-database'
import type { JournalHostDatabase } from './journal-host-database'
import {
  readSessionMetaRow,
  sessionMetaRowsIn,
  writeSessionMetaRow,
  type SessionMetaRows
} from './session-meta-rows'

export type ChildWorkHistoryRows = SessionMetaRows

const ROW_KEY_PREFIX = 'child-work-history:v1:'

export function readChildWorkHistoryRow(db: Database.Database, sessionId: string): string | null {
  return readSessionMetaRow(db, ROW_KEY_PREFIX, sessionId)
}

export function writeChildWorkHistoryRow(
  db: Database.Database,
  sessionId: string,
  value: string | null
): void {
  writeSessionMetaRow(db, ROW_KEY_PREFIX, sessionId, value)
}

export function childWorkHistoryRowsIn(
  database: JournalHostDatabase,
  onFailure: (error: unknown) => void = () => undefined
): ChildWorkHistoryRows {
  return sessionMetaRowsIn(database, ROW_KEY_PREFIX, onFailure)
}
