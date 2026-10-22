// The held reply suggestion as the host stores it: one small JSON row per chat. A row names the
// journal state it was published against, so a restore keeps it only while that state still holds.
// A row this build cannot read, or one too large to be what it writes, is ignored.

import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import { MAX_REPLY_SUGGESTION_LENGTH } from '../../../shared/native-chat-reply-suggestion'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'

export const PERSISTED_PROMPT_SUGGESTION_VERSION = 1
/** A suggestion is at most MAX_REPLY_SUGGESTION_LENGTH characters, so a row is far below this. */
const MAX_PERSISTED_ROW_CHARS = 2048
const MAX_IDENTIFIER_CHARS = 512

/** What the journal held when a suggestion was published: its epoch and the newest user message. */
export type PromptSuggestionBaseline = {
  epoch: string
  /** The newest user message's sequence, or -1 while the journal has none. */
  userSeq: number
}

export type PersistedPromptSuggestion = PromptSuggestionBaseline & {
  v: typeof PERSISTED_PROMPT_SUGGESTION_VERSION
  /** The settled turn the suggestion follows. */
  anchorTurnId: string
  /** Set by a dismissal, which keeps the dismissed suggestion from returning after a restart. */
  dismissed: boolean
  /** Null exactly when dismissed. */
  suggestion: NativeChatReplySuggestion | null
}

export function encodePersistedPromptSuggestion(row: PersistedPromptSuggestion): string | null {
  const encoded = JSON.stringify(row)
  return encoded.length <= MAX_PERSISTED_ROW_CHARS ? encoded : null
}

export function decodePersistedPromptSuggestion(
  raw: string | null
): PersistedPromptSuggestion | null {
  if (raw === null || raw.length > MAX_PERSISTED_ROW_CHARS) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.v !== PERSISTED_PROMPT_SUGGESTION_VERSION) {
    return null
  }
  const { epoch, anchorTurnId, userSeq, dismissed } = parsed
  if (!isIdentifier(epoch) || !isIdentifier(anchorTurnId)) {
    return null
  }
  if (typeof userSeq !== 'number' || !Number.isSafeInteger(userSeq) || userSeq < -1) {
    return null
  }
  if (typeof dismissed !== 'boolean') {
    return null
  }
  const suggestion = decodeSuggestion(parsed.suggestion)
  if (suggestion === undefined || (dismissed ? suggestion !== null : suggestion === null)) {
    return null
  }
  return {
    v: PERSISTED_PROMPT_SUGGESTION_VERSION,
    epoch,
    anchorTurnId,
    userSeq,
    dismissed,
    suggestion
  }
}

/** A suggestion, null for none, or undefined when the value is not one this build writes. */
function decodeSuggestion(value: unknown): NativeChatReplySuggestion | null | undefined {
  if (value === null) {
    return null
  }
  if (!isRecord(value)) {
    return undefined
  }
  const { turnId, text, source } = value
  if (
    !isIdentifier(turnId) ||
    typeof text !== 'string' ||
    text.length === 0 ||
    text.length > MAX_REPLY_SUGGESTION_LENGTH ||
    (source !== 'native' && source !== 'emulated')
  ) {
    return undefined
  }
  return { turnId, text, source }
}

/** What a restore and a send read off the journal, all of it in memory. */
export type JournalSuggestionFacts = PromptSuggestionBaseline & {
  /** The turn the journal settled last, when none runs; null otherwise. */
  settledTurnId: string | null
  /** A send the journal has accepted but not yet dispatched to the provider. */
  pendingDispatch: boolean
}

export function readJournalSuggestionFacts(journal: AgentSessionJournal): JournalSuggestionFacts {
  let userSeq = -1
  journal.visitItems((_itemId, sequence, body) => {
    if (body.kind === 'message' && body.role === 'user' && sequence > userSeq) {
      userSeq = sequence
    }
  })
  const newest = journal.newestTurn()
  return {
    epoch: journal.cursor().epoch,
    userSeq,
    settledTurnId:
      journal.activeTurnId() === null && newest && newest.state !== 'running'
        ? newest.turnId
        : null,
    pendingDispatch: journal.pendingSubmissions().length > 0
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_IDENTIFIER_CHARS
}
