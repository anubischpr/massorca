// One JSON value per chat in the host database's store metadata table, under a per-feature key
// prefix. A failed write is reported, never retried: each feature's reader refuses a row that no
// longer describes the chat.

import type Database from '../../sqlite/sync-database'
import type { JournalHostDatabase } from './journal-host-database'

export type SessionMetaRows = {
  read: (sessionId: string) => string | null
  /** `null` deletes the chat's row. */
  write: (sessionId: string, value: string | null) => void
}

export function readSessionMetaRow(
  db: Database.Database,
  keyPrefix: string,
  sessionId: string
): string | null {
  const value = db
    .prepare('SELECT value FROM agent_session_store_meta WHERE key = ?')
    .get(`${keyPrefix}${sessionId}`)?.value
  return typeof value === 'string' ? value : null
}

export function writeSessionMetaRow(
  db: Database.Database,
  keyPrefix: string,
  sessionId: string,
  value: string | null
): void {
  const key = `${keyPrefix}${sessionId}`
  if (value === null) {
    db.prepare('DELETE FROM agent_session_store_meta WHERE key = ?').run(key)
    return
  }
  db.prepare('INSERT OR REPLACE INTO agent_session_store_meta (key, value) VALUES (?, ?)').run(
    key,
    value
  )
}

/** The rows of one host database. A closed or read-only database keeps none; `onFailure` hears of
 *  a read or write that did not complete. */
export function sessionMetaRowsIn(
  database: JournalHostDatabase,
  keyPrefix: string,
  onFailure: (error: unknown) => void = () => undefined
): SessionMetaRows {
  return {
    read: (sessionId) => {
      try {
        return readSessionMetaRow(database.db, keyPrefix, sessionId)
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
        database.transaction((db) => writeSessionMetaRow(db, keyPrefix, sessionId, value))
      } catch (error) {
        onFailure(error)
      }
    }
  }
}
