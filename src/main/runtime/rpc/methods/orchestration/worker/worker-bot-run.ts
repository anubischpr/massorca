import { botRunOfCallerSession } from '../../../../../bot-teams/bot-team-delegated-run'
import {
  botRunOptions,
  resolveBotRunDenial
} from '../../../../../marketplace/marketplace-bot-run-denial'
import { getStructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/structured-agent-session-registry'
import type { OrchestrationDb } from '../../../../orchestration/db'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import type { RpcContext } from '../../../core'
import { readCallerSessionRecord } from '../../../orchestration-session-caller'
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

/**
 * Refuses a terminal or agent launch from a caller session whose bot is kept out of a Marketplace
 * app: Orca spawns it outside the bot's process, so it would get the host's tokens and config.
 * A request with no session evidence, or from another host, is no bot's and runs as it did.
 */
export async function refuseDeniedBotCaller(
  runtime: OrcaRuntimeService,
  context: Partial<Pick<RpcContext, 'orchestrationCompatibilityEvidence' | 'pairedDeviceId'>>,
  kind: string
): Promise<void> {
  if (context.orchestrationCompatibilityEvidence?.agentSessionId === undefined) {
    return
  }
  const record = await readCallerSessionRecord(
    runtime,
    context.orchestrationCompatibilityEvidence,
    {
      pairedDeviceId: context.pairedDeviceId
    }
  )
  if (!record) {
    return
  }
  const db = runtime.getOrchestrationDb()
  await refuseWorkerForDeniedBot(
    botRunOfCallerSession(db, record.sessionId, () => record.options),
    kind
  )
}
