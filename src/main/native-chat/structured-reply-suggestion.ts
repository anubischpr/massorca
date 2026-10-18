import type { AgentSessionRecord } from '../../shared/agent-session-record'
import type { AgentSessionStatusSummary } from '../../shared/agent-session-wire'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type {
  NativeChatReplySuggestion,
  ReplySuggestionExchange
} from '../../shared/native-chat-reply-suggestion'
import type { StructuredAgentSessionStatusObserverOptions } from './agent-session-wire/structured-agent-session-status-observation'
import {
  neverThrowingStructuredAgentSessionLogger,
  type StructuredAgentSessionLogger
} from './agent-session-wire/structured-agent-session-logger'

/** A queued follow-up starts its turn within this; a suggestion for a turn it replaces is never asked. */
export const REPLY_SUGGESTION_START_DELAY_MS = 1_500
/** How long Claude's own prediction, which follows the turn's result, is waited for before a
 *  model is asked instead. */
export const REPLY_SUGGESTION_NATIVE_GRACE_MS = 3_500
const MAX_TRACKED_SESSIONS = 512

export type StructuredReplySuggestionDeps = {
  getSettings: () => Pick<
    GlobalSettings,
    'nativeChatReplySuggestions' | 'nativeChatEmulatedReplySuggestions'
  >
  getRecord: (sessionId: string) => AgentSessionRecord | undefined
  hasOpenDispatch: (record: AgentSessionRecord) => boolean
  /** The settled turn's last exchange; null when it said too little to predict from. */
  readExchange: (sessionId: string) => Promise<ReplySuggestionExchange | null>
  /** The suggestion the host already holds for the session, whatever its source. */
  readHeld: (sessionId: string) => NativeChatReplySuggestion | undefined
  /** One short model call on the session's execution host; null when none could be made. */
  generate: (
    record: AgentSessionRecord,
    exchange: ReplySuggestionExchange
  ) => Promise<string | null>
  /** Stops the call in flight for the session, if any. */
  cancelGeneration: (sessionId: string) => void
  publish: (sessionId: string, suggestion: NativeChatReplySuggestion | null) => void
  sleep?: (ms: number) => Promise<void>
  logger: StructuredAgentSessionLogger
}

function remember<T>(map: Map<string, T>, key: string, value: T): void {
  map.delete(key)
  map.set(key, value)
  if (map.size > MAX_TRACKED_SESSIONS) {
    const oldest = map.keys().next()
    if (!oldest.done) {
      map.delete(oldest.value)
    }
  }
}

/**
 * Suggests a next user message for agents with no prediction of their own. Runs on whichever
 * runtime hosts the session, after a turn ends with a success verdict; a new turn cancels the call
 * and clears what it produced, so a suggestion never outlives the turn it follows.
 */
export function createStructuredReplySuggestionHandler(deps: StructuredReplySuggestionDeps) {
  const logger = neverThrowingStructuredAgentSessionLogger(deps.logger)
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const lastStatus = new Map<string, AgentSessionStatusSummary['status']>()
  const generations = new Map<string, number>()

  const supersede = (sessionId: string): number => {
    const next = (generations.get(sessionId) ?? 0) + 1
    remember(generations, sessionId, next)
    return next
  }

  async function suggest(summary: AgentSessionStatusSummary, token: number): Promise<void> {
    const { sessionId } = summary
    const settings = deps.getSettings()
    // The emulated setting is the sub-toggle: both must allow a model call.
    if (
      settings.nativeChatReplySuggestions === false ||
      settings.nativeChatEmulatedReplySuggestions === false
    ) {
      return
    }
    const record = deps.getRecord(sessionId)
    if (!record || deps.hasOpenDispatch(record)) {
      return
    }
    await sleep(
      record.provider === 'claude'
        ? REPLY_SUGGESTION_NATIVE_GRACE_MS
        : REPLY_SUGGESTION_START_DELAY_MS
    )
    // Claude predicts for itself; ask a model only when it has not.
    if (generations.get(sessionId) !== token || deps.readHeld(sessionId)) {
      return
    }
    const exchange = await deps.readExchange(sessionId)
    if (!exchange || generations.get(sessionId) !== token) {
      return
    }
    const text = await deps.generate(record, exchange)
    if (!text || generations.get(sessionId) !== token) {
      return
    }
    deps.publish(sessionId, {
      turnId: `emulated-${summary.statusStartedAt ?? summary.updatedAt}`,
      text,
      source: 'emulated'
    })
  }

  return (
    summary: AgentSessionStatusSummary,
    options: StructuredAgentSessionStatusObserverOptions
  ): void => {
    if (options.replay) {
      return
    }
    const { sessionId } = summary
    const previous = lastStatus.get(sessionId)
    remember(lastStatus, sessionId, summary.status)
    if (summary.status === 'working') {
      if (previous !== 'working') {
        supersede(sessionId)
        deps.cancelGeneration(sessionId)
        deps.publish(sessionId, null)
      }
      return
    }
    // Only the edge out of work, and only a turn that succeeded: a failure or a stop has no next step.
    if (summary.status !== 'idle' || previous !== 'working' || summary.turnOutcome !== 'success') {
      return
    }
    const token = supersede(sessionId)
    void suggest(summary, token).catch((error: unknown) =>
      logger.warn('Reply suggestion failed', { scope: 'reply-suggestion', sessionId, error })
    )
  }
}
