import type { AgentJournalRenderItem } from '../../shared/agent-session-journal-types'
import { botTeamQuestionOf } from '../../shared/bot-team-task-question'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

export type BotTeamTaskQuestionDeps = {
  /** The bot posts its own lines from its session, which can land just after the status flips. */
  settleMs: number
  /** The text of the bot's last reply in the session; null when this host cannot read it. */
  lastReplyOf: (sessionId: string) => Promise<string | null>
}

const MIN_MATCH_LENGTH = 8

/**
 * What the session's own agent said last, if the person has not spoken since. A helper agent's rows
 * and reasoning are not the bot's words.
 */
export function lastAssistantReplyOf(items: readonly AgentJournalRenderItem[]): string | null {
  const ordered = items
    .filter((item) => item.body.kind === 'message' && item.agentId === undefined)
    .toSorted((a, b) => a.sequence - b.sequence || (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))
  for (let at = ordered.length - 1; at >= 0; at--) {
    const body = ordered[at].body
    if (body.kind !== 'message') {
      continue
    }
    if (body.role === 'user') {
      return null
    }
    if (body.role === 'assistant') {
      const text = body.blocks
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim()
      if (text !== '') {
        return text
      }
    }
  }
  return null
}

function compact(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/** The bot's own lines since the person last spoke: the ones a question of this turn can sit in. */
function botLinesThisTurn(
  messages: readonly BotTeamMessage[],
  task: { ownerBotId: string; createdAt?: number | null }
): BotTeamMessage[] {
  const lastPerson = messages.findLast((message) => message.authorBotId === null)
  const since = Math.max(task.createdAt ?? 0, lastPerson?.createdAt ?? 0)
  return messages.filter(
    (message) => message.authorBotId === task.ownerBotId && (message.createdAt ?? 0) >= since
  )
}

function alreadyAsked(question: string, lines: readonly BotTeamMessage[]): boolean {
  const wanted = compact(question)
  return lines.some((line) => {
    const said = compact(line.text)
    return said.length >= MIN_MATCH_LENGTH && (said.includes(wanted) || wanted.includes(said))
  })
}

/**
 * When a bot's task session ends its turn on a question for the person, puts that question in the
 * room as the bot's line (unless the bot already asked it there) and marks the task as waiting for
 * the person instead of done. The person's next line reaches the same session.
 */
export async function postBotTeamTaskQuestion(
  db: OrchestrationDb,
  sessionId: string,
  deps: BotTeamTaskQuestionDeps
): Promise<void> {
  const found = db.findBotTeamTaskBySession(sessionId)
  // A task another team asked for answers to the asking room (see `returnFinishedBotTeamTask`).
  if (!found || db.getBotTeamTaskOrigin(found.id)) {
    return
  }
  if (deps.settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, deps.settleMs))
  }
  // Why: a session that works again, or stopped, within the settle time is not waiting on anyone.
  const task = db.findBotTeamTaskBySession(sessionId)
  if (!task || task.lastStatus !== 'Done') {
    return
  }
  const reply = await deps.lastReplyOf(sessionId)
  const question = reply === null ? null : botTeamQuestionOf(reply)
  if (question === null) {
    return
  }
  const lines = botLinesThisTurn(db.listBotTeamMessages(task.teamId), task)
  db.markBotTeamTaskWaiting(task.id)
  if (!alreadyAsked(question, lines)) {
    db.postBotTeamMessage({ teamId: task.teamId, authorBotId: task.ownerBotId, text: question })
  }
}
