import { useCallback } from 'react'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import type { NativeChatPrototypeChoice } from '../../../src/shared/prototype-request-decision'
import { createMobilePrototypeRequest } from '../session/mobile-prototype-host-rpc'
import type { StructuredMobileSendAttachment } from '../session/use-mobile-structured-send-with-outcome'
import type { RpcClient } from '../transport/rpc-client'
import { mobilePrototypeAgentFor, mobilePrototypeAgentName } from './mobile-prototype-agent'
import { mobilePrototypeAsks } from './mobile-prototype-ask-store'
import { readMobilePrototypeCountSetting } from './mobile-prototype-count-setting'
import { planMobilePrototypeOutgoing } from './mobile-prototype-outgoing'

export type MobilePrototypeSendInput = {
  text: string
  images?: string[]
  attachments?: readonly StructuredMobileSendAttachment[]
  choice?: NativeChatPrototypeChoice
}

export type MobilePrototypeSendResolution =
  /** Goes out now: `wireText` to the agent, `shownText` for the pending echo. */
  | { kind: 'send'; wireText: string; shownText: string }
  /** Nothing goes out now: the card waits for its answer, or a request is already being made. */
  | { kind: 'held' }

// A request is made once per press: a second Send while the host answers waits for the first.
const inFlight = new Set<string>()

/** Plans one structured composer send for the chat of `scopeKey`; see `planMobilePrototypeOutgoing`. */
export function useMobileNativeChatPrototypeOutgoing(args: {
  client: RpcClient | null
  scopeKey: string
  /** The structured chat's session id; absent, no request folder can be made. */
  sessionId: string | null
  worktreeId: string
  agent: string | null | undefined
  piRuntime: PiRowRuntime | undefined
}): (input: MobilePrototypeSendInput) => Promise<MobilePrototypeSendResolution> {
  const { client, scopeKey, sessionId, worktreeId, agent, piRuntime } = args
  return useCallback(
    async (input) => {
      const prototypeAgent = mobilePrototypeAgentFor(agent, piRuntime)
      // Any other message sent meanwhile retires a card still waiting for its answer.
      mobilePrototypeAsks.take(scopeKey)
      if (inFlight.has(scopeKey)) {
        return { kind: 'held' }
      }
      inFlight.add(scopeKey)
      try {
        const planned = await planMobilePrototypeOutgoing({
          text: input.text,
          agent: prototypeAgent,
          readSetting: () =>
            client === null
              ? Promise.resolve({ mode: 'always' as const, count: 2 })
              : readMobilePrototypeCountSetting(client),
          createRequest:
            client === null || sessionId === null
              ? null
              : (params) =>
                  createMobilePrototypeRequest(client, {
                    sessionId,
                    agent: prototypeAgent,
                    originalPrompt: params.text,
                    count: params.count,
                    ...(worktreeId ? { worktreeId } : {})
                  }),
          ...(input.choice ? { choice: input.choice } : {})
        })
        if (planned.kind === 'ask') {
          mobilePrototypeAsks.write(scopeKey, {
            text: input.text,
            ...(input.images ? { images: input.images } : {}),
            ...(input.attachments ? { attachments: input.attachments } : {}),
            keyword: planned.keyword,
            defaultCount: planned.defaultCount,
            agentName: mobilePrototypeAgentName(agent, piRuntime)
          })
          return { kind: 'held' }
        }
        return planned
      } finally {
        inFlight.delete(scopeKey)
      }
    },
    [agent, client, piRuntime, scopeKey, sessionId, worktreeId]
  )
}
