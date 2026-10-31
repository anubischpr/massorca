// `agentSession.subscribeStatus` — every structured session's projected status on one stream.
//
// Session lists read turn state from here instead of replaying transcripts: one stream per client
// covers every session, and unlike a transcript subscription it retains none of them.

import { defineStreamingMethod, type RpcContext } from '../core'
import { requireStructuredHost as requireHost } from './structured-agent-session-gate'
import { structuredAgentSessionStatusSubscriptionId } from './structured-agent-session-subscription-id'
import { clientReadsStructuredSessionAgent } from './structured-agent-session-policy'
import { attachDelegatedParents } from './structured-agent-session-status-delegated-parent'

/** Ties a stream to both ends that can close it — the runtime's subscription registry and the
 *  transport abort — so either one runs `onClose` exactly once. */
export function bindStructuredAgentSessionStream(
  ctx: RpcContext,
  subscriptionId: string,
  onClose: () => void
): { isClosed: () => boolean } {
  let closed = false
  let releaseTransportSubscription = (): void => {}
  const onTransportAbort = (): void => releaseTransportSubscription()
  const cleanup = (): void => {
    closed = true
    ctx.signal?.removeEventListener('abort', onTransportAbort)
    onClose()
  }
  let registration: { releaseIfCurrent: () => void }
  if (typeof ctx.runtime.registerOwnedSubscriptionCleanup === 'function') {
    registration = ctx.runtime.registerOwnedSubscriptionCleanup(
      subscriptionId,
      cleanup,
      ctx.connectionId
    )
  } else {
    ctx.runtime.registerSubscriptionCleanup(subscriptionId, cleanup, ctx.connectionId)
    registration = { releaseIfCurrent: () => ctx.runtime.cleanupSubscription(subscriptionId) }
  }
  releaseTransportSubscription = registration.releaseIfCurrent
  ctx.signal?.addEventListener('abort', onTransportAbort, { once: true })
  if (ctx.signal?.aborted) {
    onTransportAbort()
  }
  return { isClosed: () => closed }
}

export const STRUCTURED_AGENT_SESSION_STATUS_METHODS = [
  defineStreamingMethod({
    name: 'agentSession.subscribeStatus',
    permission: 'workspace',
    params: null,
    handler: async (_params, ctx, emit) => {
      const host = requireHost(ctx)
      const subscriptionId = structuredAgentSessionStatusSubscriptionId(ctx)
      let dispose = (): void => {}
      const stream = bindStructuredAgentSessionStream(ctx, subscriptionId, () => dispose())
      if (stream.isClosed()) {
        return
      }
      const withParents = (sessions: Parameters<typeof attachDelegatedParents>[0]) => {
        const db = ctx.runtime.getOrchestrationDb?.()
        return attachDelegatedParents(sessions, db?.listDelegatedChildLinks?.bind(db))
      }
      dispose = host.subscribeStatus({
        id: subscriptionId,
        emit: (event) => {
          if (event.type === 'snapshot') {
            emit({
              ...event,
              sessions: withParents(
                event.sessions.filter((session) =>
                  clientReadsStructuredSessionAgent(ctx, session.agent)
                )
              )
            })
          } else if (
            event.type !== 'status' ||
            clientReadsStructuredSessionAgent(ctx, event.session.agent)
          ) {
            emit(
              event.type === 'status'
                ? { ...event, session: withParents([event.session])[0] ?? event.session }
                : event
            )
          }
        }
      })
      if (stream.isClosed()) {
        dispose()
      }
    }
  })
]
