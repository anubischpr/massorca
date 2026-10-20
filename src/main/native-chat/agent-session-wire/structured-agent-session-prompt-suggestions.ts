import type { AgentSessionSubscribeEvent } from '../../../shared/agent-session-wire'
import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import type { PromptSuggestionRows } from '../agent-session-journal/prompt-suggestion-rows'
import { emptyAgentSessionBatch } from './agent-session-empty-batch'
import { rememberSessionActivity } from './structured-agent-session-activity-retention'
import {
  PERSISTED_PROMPT_SUGGESTION_VERSION,
  decodePersistedPromptSuggestion,
  encodePersistedPromptSuggestion,
  readJournalSuggestionFacts,
  type PersistedPromptSuggestion,
  type PromptSuggestionBaseline
} from './structured-agent-session-prompt-suggestion-record'
import type { Subscriber } from './structured-agent-session-subscribers'

export type PromptSuggestionPort = {
  subscribers: (sessionId: string) => Subscriber[]
  emit: (subscriber: Subscriber, event: AgentSessionSubscribeEvent) => void
  now: () => number
  /** Whether a suggestion from this source may be published; absent allows both. */
  isEnabled?: (source: NativeChatReplySuggestion['source']) => boolean
  /** The chat's live journal, read when a publish or a dismissal names none. */
  journalOf?: (sessionId: string) => AgentSessionJournal | undefined
  /** Queued drafts the host holds: user input that no journal row shows yet. */
  queuedCount?: (sessionId: string) => number
  /** The host database's row for each chat; absent keeps the suggestion in memory only. */
  rows?: PromptSuggestionRows
}

type HeldPromptSuggestion = {
  suggestion: NativeChatReplySuggestion
  /** The journal state it was published against; null when no journal was readable. */
  baseline: PromptSuggestionBaseline | null
  /** The settled turn it follows; null when none was settled. */
  anchorTurnId: string | null
}

/**
 * Each session's suggested next user message, held so a subscriber that opens after it arrived
 * still gets it with no new generation, and sent to the live ones as frames that advance nothing.
 * The next turn clears it, and so does a user message sent after it. It is also written to the
 * host's row for the chat, so a restarted host restores it, without a model call, while it still
 * follows the newest settled turn.
 */
export class StructuredAgentSessionPromptSuggestions {
  private readonly held = new Map<string, HeldPromptSuggestion>()
  private readonly restored = new Map<string, boolean>()

  constructor(private readonly port: PromptSuggestionPort) {}

  get(sessionId: string): NativeChatReplySuggestion | undefined {
    return this.held.get(sessionId)?.suggestion
  }

  /** Only while one is held: an opening frame without the field reads as "no suggestion". */
  openingField(sessionId: string): { promptSuggestion?: NativeChatReplySuggestion } {
    const suggestion = this.get(sessionId)
    return suggestion ? { promptSuggestion: suggestion } : {}
  }

  /** Sets or, with null, clears it for every subscriber, and writes the chat's row to match. A
   *  suggestion whose source the user turned off is dropped, not held. `journal` is the one the
   *  suggestion follows; absent, the live journal is read. */
  publish(
    sessionId: string,
    suggestion: NativeChatReplySuggestion | null,
    journal?: AgentSessionJournal
  ): void {
    if (suggestion && this.port.isEnabled?.(suggestion.source) === false) {
      return
    }
    if (!suggestion) {
      this.writeRow(sessionId, null)
      if (!this.held.delete(sessionId)) {
        return
      }
      this.broadcast(sessionId, null)
      return
    }
    const source = journal ?? this.port.journalOf?.(sessionId)
    const facts = source ? readJournalSuggestionFacts(source) : null
    const baseline = facts ? { epoch: facts.epoch, userSeq: facts.userSeq } : null
    const anchorTurnId = facts?.settledTurnId ?? null
    rememberSessionActivity(this.held, sessionId, { suggestion, baseline, anchorTurnId })
    // A native prediction is only ever for the turn that settled; an emulated one follows it by design.
    const follows = suggestion.source === 'emulated' || suggestion.turnId === anchorTurnId
    this.writeRow(
      sessionId,
      baseline && anchorTurnId !== null && follows
        ? {
            ...baseline,
            v: PERSISTED_PROMPT_SUGGESTION_VERSION,
            anchorTurnId,
            dismissed: false,
            suggestion
          }
        : null
    )
    this.broadcast(sessionId, suggestion)
  }

  /** The client's Esc. Drops the suggestion it names for every client, and keeps it dropped across a
   *  restart; a suggestion the host no longer holds is not dropped. */
  dismiss(sessionId: string, key: { turnId: string; text: string }): boolean {
    const held = this.held.get(sessionId)
    if (!held || held.suggestion.turnId !== key.turnId || held.suggestion.text !== key.text) {
      return false
    }
    this.held.delete(sessionId)
    const { baseline, anchorTurnId } = held
    this.writeRow(
      sessionId,
      baseline && anchorTurnId !== null
        ? {
            ...baseline,
            v: PERSISTED_PROMPT_SUGGESTION_VERSION,
            anchorTurnId,
            dismissed: true,
            suggestion: null
          }
        : null
    )
    this.broadcast(sessionId, null)
    return true
  }

  /** A journal publication. A user message, or a new journal epoch, since the held suggestion's
   *  baseline ends it, the same as a send. */
  observeJournal(sessionId: string, journal: AgentSessionJournal): void {
    const baseline = this.held.get(sessionId)?.baseline
    if (!baseline) {
      return
    }
    const facts = readJournalSuggestionFacts(journal)
    if (facts.epoch !== baseline.epoch || facts.userSeq > baseline.userSeq) {
      this.publish(sessionId, null)
    }
  }

  /** Once per chat per host start, with no model call: holds the stored suggestion again, but only
   *  while the journal is the one it was written against, its turn is still the newest settled one,
   *  no user message or queued draft has come since, and the chat is not dispatching a send. */
  restore(sessionId: string, journal: AgentSessionJournal): void {
    if (this.held.has(sessionId) || this.restored.has(sessionId)) {
      return
    }
    rememberSessionActivity(this.restored, sessionId, true)
    const row = decodePersistedPromptSuggestion(this.port.rows?.read(sessionId) ?? null)
    if (!row || row.dismissed || row.suggestion === null) {
      return
    }
    if (this.port.isEnabled?.(row.suggestion.source) === false) {
      return
    }
    const facts = readJournalSuggestionFacts(journal)
    const current =
      facts.epoch === row.epoch &&
      facts.settledTurnId === row.anchorTurnId &&
      facts.userSeq <= row.userSeq &&
      !facts.pendingDispatch &&
      (this.port.queuedCount?.(sessionId) ?? 0) === 0
    if (!current) {
      return
    }
    rememberSessionActivity(this.held, sessionId, {
      suggestion: row.suggestion,
      baseline: { epoch: row.epoch, userSeq: row.userSeq },
      anchorTurnId: row.anchorTurnId
    })
  }

  /** A resuming subscriber's caught-up frame carries no suggestion field; state it separately. */
  resend(subscriber: Subscriber, hostNow: number): void {
    const suggestion = this.get(subscriber.sessionId)
    if (suggestion) {
      this.port.emit(subscriber, this.frame(subscriber, hostNow, suggestion))
    }
  }

  private broadcast(sessionId: string, suggestion: NativeChatReplySuggestion | null): void {
    const hostNow = this.port.now()
    for (const subscriber of this.port.subscribers(sessionId)) {
      this.port.emit(subscriber, this.frame(subscriber, hostNow, suggestion))
    }
  }

  private writeRow(sessionId: string, row: PersistedPromptSuggestion | null): void {
    this.port.rows?.write(sessionId, row && encodePersistedPromptSuggestion(row))
  }

  private frame(
    subscriber: Subscriber,
    hostNow: number,
    promptSuggestion: NativeChatReplySuggestion | null
  ): AgentSessionSubscribeEvent {
    return {
      type: 'batch',
      sessionId: subscriber.sessionId,
      batch: emptyAgentSessionBatch(subscriber.cursor),
      fence: subscriber.fence,
      hostNow,
      promptSuggestion
    }
  }
}
