import type { MutableRefObject } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import { useMobileBridgeChatPromptWrites } from './use-mobile-bridge-chat-prompt-writes'
import { useMobileNativeChatAskDismiss } from './use-mobile-native-chat-ask-dismiss'
import { useMobileNativeChatMessageSend } from './use-mobile-native-chat-message-send'
import { useMobileNativeChatPrompts } from './use-mobile-native-chat-prompts'

type MessageSendArgs = Parameters<typeof useMobileNativeChatMessageSend>[0]
type PromptsArgs = Parameters<typeof useMobileNativeChatPrompts>[0]

/** What only a terminal-bridged chat runs: prompts read from the transcript and writes to the PTY. */
export function useMobileBridgeNativeChatLane(args: {
  client: RpcClient | null
  promptsEnabled: boolean
  writesEnabled: boolean
  status: PromptsArgs['status']
  messages: PromptsArgs['messages']
  transcriptLoading: boolean
  /** A never-read transcript cannot prove that a dismissed prompt cleared. */
  transcriptSettled: boolean
  chatVisible: boolean
  scopeKey: Parameters<typeof useMobileNativeChatAskDismiss>[0]['scopeKey']
  sessionId: string | null
  streamIdentity: string
  handleRef: MutableRefObject<string | null>
  deviceTokenRef: MutableRefObject<string | null>
  agentRef: MutableRefObject<string | null>
  commandSendRef: MessageSendArgs['commandSendRef']
  captureSendOrigin: MessageSendArgs['captureSendOrigin']
  readSeededLaunchDraftSeed: MessageSendArgs['readSeededLaunchDraftSeed']
  clearDraftForSend: MessageSendArgs['clearDraftForSend']
  restoreRejectedDraft: MessageSendArgs['restoreRejectedDraft']
  acceptSend: MessageSendArgs['acceptSend']
  holdUnconfirmedSend: MessageSendArgs['holdUnconfirmedSend']
  onSendError: MessageSendArgs['onSendError']
}) {
  const { client, writesEnabled: enabled, handleRef, deviceTokenRef, agentRef, onSendError } = args
  const prompts = useMobileNativeChatPrompts({
    enabled: args.promptsEnabled,
    status: args.status,
    messages: args.messages,
    transcriptLoading: args.transcriptLoading
  })
  const askDismissal = useMobileNativeChatAskDismiss({
    ask: prompts.ask,
    detectedAsk: prompts.detectedAsk,
    scopeKey: args.scopeKey,
    sessionKey: args.sessionId,
    observing: args.chatVisible && (prompts.detectedAsk != null || args.transcriptSettled)
  })
  const promptWrites = useMobileBridgeChatPromptWrites({
    client,
    enabled,
    handleRef,
    deviceTokenRef,
    agentRef,
    sessionId: args.sessionId,
    streamIdentity: args.streamIdentity,
    onSendError
  })
  const messageSend = useMobileNativeChatMessageSend({
    client,
    enabled,
    handleRef,
    deviceTokenRef,
    agentRef,
    commandSendRef: args.commandSendRef,
    captureSendOrigin: args.captureSendOrigin,
    readSeededLaunchDraftSeed: args.readSeededLaunchDraftSeed,
    clearDraftForSend: args.clearDraftForSend,
    restoreRejectedDraft: args.restoreRejectedDraft,
    acceptSend: args.acceptSend,
    holdUnconfirmedSend: args.holdUnconfirmedSend,
    onSendError
  })
  return { prompts, askDismissal, promptWrites, messageSend }
}
