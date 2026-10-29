import { useCallback, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from 'react'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { NativeChatPrototypeChoice } from '../../../src/shared/prototype-request-decision'
import type { MobileNativeChatSendOutcome } from '../session/mobile-native-chat-send'
import type { StructuredMobileSendAttachment } from '../session/use-mobile-structured-send-with-outcome'
import type { RpcClient } from '../transport/rpc-client'
import { mobilePrototypeAsks, type MobilePrototypeAsk } from './mobile-prototype-ask-store'
import { useMobileNativeChatPrototypeOutgoing } from './use-mobile-native-chat-prototype-outgoing'
import { useMobilePrototypeChatSets } from './use-mobile-prototype-chat-sets'

type ComposerSend = (
  text: string,
  images?: string[],
  deadline?: number,
  attachments?: readonly StructuredMobileSendAttachment[],
  prototypeChoice?: NativeChatPrototypeChoice
) => Promise<MobileNativeChatSendOutcome>

/**
 * What a structured chat does with prototype requests: the planner its composer send calls, the
 * "How many prototypes?" card waiting for its answer, the sets its requests opened, and the plain
 * send the Prototypes screens use. The composer send is set into `composerSend` once it exists,
 * because it needs the planner first.
 */
export function useMobileNativeChatPrototypeSurface(args: {
  client: RpcClient | null
  /** Null off the structured lane: nothing here applies. */
  sessionId: string | null
  worktreeId: string
  scopeKey: string
  agent: string | null | undefined
  piRuntime: PiRowRuntime | undefined
  messages: readonly NativeChatMessage[]
  /** The send with no composer around it. */
  plainSend: (text: string) => Promise<MobileNativeChatSendOutcome>
}): {
  resolve: ReturnType<typeof useMobileNativeChatPrototypeOutgoing>
  composerSend: MutableRefObject<ComposerSend | null>
  fields: {
    nativeChatPrototypeAsk: MobilePrototypeAsk | null
    answerNativeChatPrototypeAsk: (choice: NativeChatPrototypeChoice) => void
    nativeChatPrototypeSend: { sessionId: string; send: (text: string) => Promise<boolean> } | null
    nativeChatPrototypeSets: ReturnType<typeof useMobilePrototypeChatSets>
  }
} {
  const { client, sessionId, worktreeId, scopeKey, agent, piRuntime, messages, plainSend } = args
  const resolve = useMobileNativeChatPrototypeOutgoing({
    client,
    scopeKey,
    sessionId,
    worktreeId,
    agent,
    piRuntime
  })
  const composerSend = useRef<ComposerSend | null>(null)
  const ask = useSyncExternalStore(mobilePrototypeAsks.subscribe, () =>
    sessionId === null ? null : (mobilePrototypeAsks.read(scopeKey) ?? null)
  )
  const answer = useCallback(
    (choice: NativeChatPrototypeChoice) => {
      const taken = mobilePrototypeAsks.take(scopeKey)
      if (taken) {
        void composerSend.current?.(taken.text, taken.images, undefined, taken.attachments, choice)
      }
    },
    [scopeKey]
  )
  const userTurnCount = useMemo(
    () => messages.filter((message) => message.role === 'user').length,
    [messages]
  )
  const sets = useMobilePrototypeChatSets({ client, sessionId, userTurnCount })
  const send = useMemo(
    () =>
      sessionId === null
        ? null
        : {
            sessionId,
            send: async (text: string): Promise<boolean> => {
              const outcome = await plainSend(text)
              return outcome === 'accepted' || outcome === 'queued'
            }
          },
    [plainSend, sessionId]
  )
  return {
    resolve,
    composerSend,
    fields: {
      nativeChatPrototypeAsk: ask,
      answerNativeChatPrototypeAsk: answer,
      nativeChatPrototypeSend: send,
      nativeChatPrototypeSets: sets
    }
  }
}
