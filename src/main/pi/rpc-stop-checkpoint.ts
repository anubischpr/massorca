import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import type { PiRpcSession } from './rpc-session'

/** After a Stop: waits briefly for the open turn to leave the lane, then reads Pi's state so the
 *  session file is checkpointed before the child is closed. A failed read is logged, not fatal. */
export async function awaitPiRpcStopCheckpoint(
  session: Pick<PiRpcSession, 'lane' | 'connection'>,
  sessionId: string,
  at: number,
  logger: StructuredAgentSessionLogger
): Promise<void> {
  const turn = session.lane.openTurnId
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (turn) {
      await Promise.race([
        session.lane.whenTurnLeaves(turn),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, Math.max(0, at + 2_000 - Date.now()))
          timer.unref()
        })
      ])
    }
  } finally {
    clearTimeout(timer)
  }
  try {
    await session.connection.request('get_state', {}, { timeoutMs: 1_000 })
  } catch (error) {
    logger.warn('Pi checkpoint could not be read before stopping', {
      scope: 'pi-stop-checkpoint',
      sessionId,
      error
    })
  }
}
