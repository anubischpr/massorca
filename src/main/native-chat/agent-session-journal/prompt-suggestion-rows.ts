// The held reply suggestion's row in the host's chat database: one JSON value per chat in the store
// metadata table, read once when a chat is first opened after the host starts and written whenever
// the suggestion changes. A failed write is reported, never retried: the restore check refuses a row
// that no longer describes the chat, so a missed write cannot show a stale suggestion.

import type Database from '../../sqlite/sync-database'
import type { JournalHostDatabase } from './journal-host-database'
import {
  readSessionMetaRow,
  sessionMetaRowsIn,
  writeSessionMetaRow,
  type SessionMetaRows
} from './session-meta-rows'

export type PromptSuggestionRows = SessionMetaRows

const ROW_KEY_PREFIX = 'prompt-suggestion:v1:'

export function readPromptSuggestionRow(db: Database.Database, sessionId: string): string | null {
  return readSessionMetaRow(db, ROW_KEY_PREFIX, sessionId)
}

export function writePromptSuggestionRow(
  db: Database.Database,
  sessionId: string,
  value: string | null
): void {
  writeSessionMetaRow(db, ROW_KEY_PREFIX, sessionId, value)
}

export function promptSuggestionRowsIn(
  database: JournalHostDatabase,
  onFailure: (error: unknown) => void = () => undefined
): PromptSuggestionRows {
  return sessionMetaRowsIn(database, ROW_KEY_PREFIX, onFailure)
}
