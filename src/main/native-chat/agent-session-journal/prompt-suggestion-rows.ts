// The held reply suggestion's row in the host's chat database: one JSON value per chat in the store
// metadata table, read once when a chat is first opened after the host starts and written whenever
// the suggestion changes. A failed write is reported, never retried: the restore check refuses a row
// that no longer describes the chat, so a missed write cannot show a stale suggestion.

import type Database from '../../sqlite/sync-database'
import type { JournalHostDatabase } from './journal-host-database'

export type PromptSuggestionRows = {
  read: (sessionId: string) => string | null
  /** `null` deletes the chat's row. */
  write: (sessionId: string, value: string | null) => void
}

const ROW_KEY_PREFIX = 'prompt-suggestion:v1:'

function rowKey(sessionId: string): string {
  return `${ROW_KEY_PREFIX}${sessionId}`
}

export function readPromptSuggestionRow(db: Database.Database, sessionId: string): string | null {
  const value = db
    .prepare('SELECT value FROM agent_session_store_meta WHERE key = ?')
    .get(rowKey(sessionId))?.value
  return typeof value === 'string' ? value : null
}

export function writePromptSuggestionRow(
  db: Database.Database,
  sessionId: string,
  value: string | null
): void {
  if (value === null) {
    db.prepare('DELETE FROM agent_session_store_meta WHERE key = ?').run(rowKey(sessionId))
    return
  }
  db.prepare('INSERT OR REPLACE INTO agent_session_store_meta (key, value) VALUES (?, ?)').run(
    rowKey(sessionId),
    value
  )
}

/** The rows of one host database. A closed or read-only database keeps none; `onFailure` hears of
 *  a read or write that did not complete. */
export function promptSuggestionRowsIn(
  database: JournalHostDatabase,
  onFailure: (error: unknown) => void = () => undefined
): PromptSuggestionRows {
  return {
    read: (sessionId) => {
      try {
        return readPromptSuggestionRow(database.db, sessionId)
      } catch (error) {
        onFailure(error)
        return null
      }
    },
    write: (sessionId, value) => {
      if (database.readOnly) {
        return
      }
      try {
        database.transaction((db) => writePromptSuggestionRow(db, sessionId, value))
      } catch (error) {
        onFailure(error)
      }
    }
  }
}
