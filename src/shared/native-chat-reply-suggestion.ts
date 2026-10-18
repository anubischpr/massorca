import type { AgentJournalRenderItem } from './agent-session-journal-types'
import { isRootAgentJournalItem } from './agent-session-journal-producer'
import { isStructuredAgentSessionCommandEntry } from './structured-agent-session-command-entry'
import { sliceAtCodeUnitLimit } from './surrogate-safe-text-slice'

/**
 * A suggested next user message, shown as ghost text in an empty composer. Ephemeral: it rides the
 * session subscription beside the journal and is never a journal row.
 */
export type NativeChatReplySuggestion = {
  /** The turn the suggestion follows; a new turn invalidates it. */
  turnId: string
  text: string
  /** `native`: the agent's own prediction. `emulated`: Orca asked a model for one. */
  source: 'native' | 'emulated'
}

export function sameReplySuggestion(
  a: NativeChatReplySuggestion | null | undefined,
  b: NativeChatReplySuggestion | null | undefined
): boolean {
  return (a?.turnId ?? null) === (b?.turnId ?? null) && (a?.text ?? null) === (b?.text ?? null)
}

/** A batch frame's effect on the held suggestion: it states one, or (on a subscription's opening
 *  frame, which describes everything the host holds) none; any other frame leaves it alone. */
export function nextReplySuggestion(
  held: { promptSuggestion?: NativeChatReplySuggestion | null | undefined },
  event: { promptSuggestion?: NativeChatReplySuggestion | null | undefined },
  opensSubscription: boolean | undefined
): NativeChatReplySuggestion | null | undefined {
  if (event.promptSuggestion !== undefined) {
    return event.promptSuggestion
  }
  return opensSubscription ? null : held.promptSuggestion
}

export const MAX_REPLY_SUGGESTION_LENGTH = 240
/** What the generation prompt may carry of the finished turn, in total. */
export const REPLY_SUGGESTION_CONTEXT_LIMIT = 4000
const USER_MESSAGE_CONTEXT_LIMIT = 1000
/** Below this the reply says too little to predict a follow-up from. */
const MIN_ASSISTANT_REPLY_LENGTH = 24

/** One line a person could plausibly type; null when nothing usable remains. */
export function normalizeReplySuggestionText(raw: string): string | null {
  // A model told to answer in one line sometimes explains below it; only the first line is the answer.
  const firstLine = raw.split(/\r?\n/u).find((line) => line.trim().length > 0) ?? ''
  let text = firstLine
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/^(?:suggested (?:reply|message)|next message|reply)\s*:\s*/iu, '')
  for (;;) {
    const unwrapped = text
      .replace(/^(["'`])(.*)\1$/u, '$2')
      .replace(/^“(.*)”$/u, '$1')
      .trim()
    if (unwrapped === text) {
      break
    }
    text = unwrapped
  }
  if (!/[\p{L}\p{N}]/u.test(text) || text.startsWith('<think>')) {
    return null
  }
  return text.length > MAX_REPLY_SUGGESTION_LENGTH
    ? sliceAtCodeUnitLimit(text, MAX_REPLY_SUGGESTION_LENGTH).trimEnd()
    : text
}

export type ReplySuggestionExchange = { userMessage: string; assistantMessage: string }

function messageText(item: AgentJournalRenderItem): string {
  if (item.body.kind !== 'message') {
    return ''
  }
  return item.body.blocks
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()
}

/**
 * The newest person message and the agent's prose since it, from a settled journal; null when the
 * turn said too little to predict a follow-up from.
 */
export function lastReplySuggestionExchange(
  items: readonly AgentJournalRenderItem[]
): ReplySuggestionExchange | null {
  const roots = items.filter(
    (item) =>
      item.body.kind === 'message' &&
      isRootAgentJournalItem(item) &&
      !isStructuredAgentSessionCommandEntry(item.body)
  )
  const lastUserIndex = roots.findLastIndex(
    (item) => item.body.kind === 'message' && item.body.role === 'user'
  )
  if (lastUserIndex === -1) {
    return null
  }
  const assistantMessage = roots
    .slice(lastUserIndex + 1)
    .filter((item) => item.body.kind === 'message' && item.body.role === 'assistant')
    .map(messageText)
    .filter(Boolean)
    .join('\n\n')
  const userMessage = messageText(roots[lastUserIndex])
  if (assistantMessage.length < MIN_ASSISTANT_REPLY_LENGTH || !userMessage) {
    return null
  }
  return { userMessage, assistantMessage }
}

/** Keeps the end of the reply, where the open question or next step usually is. */
function clampTail(text: string, limit: number): string {
  return text.length <= limit ? text : `...${text.slice(text.length - limit + 3)}`
}

export function buildReplySuggestionPrompt(exchange: ReplySuggestionExchange): string {
  const user = sliceAtCodeUnitLimit(exchange.userMessage, USER_MESSAGE_CONTEXT_LIMIT)
  const assistant = clampTail(
    exchange.assistantMessage,
    REPLY_SUGGESTION_CONTEXT_LIMIT - user.length
  )
  return `Predict what the user will most likely type next in this chat with a coding agent.
Write one short message of at most ${MAX_REPLY_SUGGESTION_LENGTH} characters, in the user's voice and language.
Output only that message, on a single line, with no quotes, label, or explanation.
If no follow-up is natural, output nothing.

User's last message:
${user}

Agent's reply:
${assistant}`
}
