import { botRunOfCallerSession } from '../../../../../bot-teams/bot-team-delegated-run'
import {
  botRunOptions,
  resolveBotRunDenial
} from '../../../../../marketplace/marketplace-bot-run-denial'
import { getStructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/structured-agent-session-registry'
import type { OrchestrationDb } from '../../../../orchestration/db'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'

export type WorkerBotRun = { botId: string; teamId: string }

/** The bot whose run the calling session belongs to; a worker it starts directly inherits it. */
export function botRunOfWorkerCaller(
  db: OrchestrationDb,
  callerSessionId: string | undefined
): WorkerBotRun | null {
  return botRunOfCallerSession(
    db,
    callerSessionId,
    (id) => getStructuredAgentSessionHost()?.deps.store.getRecord(id)?.options
  )
}

/**
 * Refuses a worker that cannot be given the bot's marker (a terminal, or one on another server)
 * when that bot is kept out of a Marketplace app: it would get the host's tokens and config.
 */
export async function refuseWorkerForDeniedBot(
  botRun: WorkerBotRun | null | undefined,
  kind: string
): Promise<void> {
  if (botRun && (await resolveBotRunDenial(botRunOptions(botRun)))) {
    throw new OrchestrationError(
      'capability_unsupported',
      `This bot is kept out of a Marketplace app, and ${kind} cannot be kept away from it. Run this part as a chat on this computer.`,
      { effectsApplied: false }
    )
  }
}
