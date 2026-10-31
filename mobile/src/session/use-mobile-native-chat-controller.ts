import { useLayoutEffect, useRef, type MutableRefObject } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import type { ConnectionState } from '../transport/types'
import type { MobileNativeChatTab } from './mobile-native-chat-eligibility'
import type { StructuredAgentSessionHostSupport } from './mobile-structured-agent-session-host-support'
import { useMobileNativeChatDrafts } from './use-mobile-native-chat-drafts'
import { useMobileNativeChatFileSearch } from './use-mobile-native-chat-file-search'
import { useMobileNativeChatStreamingState } from './use-mobile-native-chat-streaming-state'
import { useMobileNativeChatSessionOptionController } from './use-mobile-native-chat-session-option-controller'
import { useMobileNativeChatSessionLane } from './use-mobile-native-chat-session-lane'
import { useMobileStructuredNativeChatSendBridge } from './use-mobile-structured-native-chat-send-bridge'
import { useNativeChatAcceptedAction } from './use-native-chat-action-outcomes'
import type { MobileNativeChatController } from './mobile-native-chat-controller-contract'
import { useMobileBridgeNativeChatLane } from './use-mobile-bridge-native-chat-lane'
import { useMobileNativeChatActiveResolution } from './use-mobile-native-chat-active-resolution'
import { useMobileNativeChatPromptCards } from './use-mobile-native-chat-prompt-cards'
import { mobileNativeChatScopeKey } from './mobile-native-chat-scope-key'
import { useMobileChatPiRuntime } from './mobile-structured-pi-runtime-record'
import { useMobileNativeChatPrototypeSurface } from '../prototypes/use-mobile-native-chat-prototype-surface'

export type { MobileNativeChatController } from './mobile-native-chat-controller-contract'

/** Owns mobile native-chat state and teardown outside the already dense session
 *  route. The route remains responsible only for choosing and rendering the view. */
export function useMobileNativeChatController(args: {
  client: RpcClient | null
  hostId: string
  worktreeId: string
  activeSessionTab: MobileNativeChatTab | null
  activeSessionTabId: string | null
  activeHandleRef: MutableRefObject<string | null>
  deviceTokenRef: MutableRefObject<string | null>
  nativeChatTranscriptIsLocalReadable: boolean
  nativeChatInputLeaseReady: boolean
  /** Live socket state; the lease collapses on disconnect but one render later. */
  connState: ConnectionState
  /** Host capability fact from the shared runtime status probe. */
  agentSessionHostSupport?: StructuredAgentSessionHostSupport | null
  /** Forwarded to the session lane, a refusal's cause with it. */
  onSendError: Parameters<typeof useMobileNativeChatSessionLane>[0]['onSendError']
  /** Retires a held failure banner. Any accepted chat write clears it — a delivered
   *  answer or permission reply must not sit under a stale "not sent". */
  onSendResolved: () => void
}): MobileNativeChatController {
  const {
    client,
    hostId,
    worktreeId,
    activeSessionTab,
    activeSessionTabId,
    activeHandleRef,
    deviceTokenRef,
    nativeChatTranscriptIsLocalReadable,
    nativeChatInputLeaseReady,
    connState,
    agentSessionHostSupport = null,
    onSendError,
    onSendResolved
  } = args
  const {
    activeChatAgent,
    activeChatAgentRef,
    activeChatResolution,
    activeChatSessionId,
    activeChatStructured,
    activeTabAgentWorking,
    isTabChatView,
    nativeChatStatus,
    showNativeChat,
    showNativeChatRef,
    sourceIdentity,
    streamIdentity,
    streamScopeKey,
    toggleTabChatView
  } = useMobileNativeChatActiveResolution({
    hostId,
    worktreeId,
    activeSessionTab,
    activeSessionTabId,
    activeHandleRef,
    nativeChatTranscriptIsLocalReadable
  })
  const nativeChatPiRuntime = useMobileChatPiRuntime(activeChatResolution)

  // The lane runs before the drafts hook (fixed hook order); Edit's composer
  // append reaches the drafts state through this ref, set below once they exist.
  // Until the drafts mount, nothing is copied, so Edit deletes nothing.
  const appendComposerTextRef = useRef<(text: string) => boolean>(() => false)
  const { structuredSession: structuredNativeChat, session: nativeChatSession } =
    useMobileNativeChatSessionLane({
      client,
      structured: activeChatStructured,
      agent: activeChatAgent,
      resolvedAgent: activeChatResolution?.agent ?? null,
      transcriptPath: activeChatResolution?.transcriptPath ?? null,
      sessionId: activeChatSessionId,
      sourceIdentity,
      enabled: showNativeChat,
      connState,
      hostSupport: agentSessionHostSupport,
      appendComposerTextRef,
      onSendError,
      onActionResolved: onSendResolved
    })
  const {
    composerText: chatComposerText,
    setComposerText: setChatComposerText,
    getComposerEditGeneration: getChatComposerEditGeneration,
    appendComposerText,
    pending: chatPending,
    imagePreviewsByMessageId: chatImagePreviewsByMessageId,
    captureSendOrigin,
    readSeededLaunchDraft,
    readSeededLaunchDraftSeed,
    clearDraftForSend,
    restoreRejectedDraft,
    acceptSend,
    holdUnconfirmedSend
  } = useMobileNativeChatDrafts({
    hostId,
    worktreeId,
    tabId: activeSessionTabId,
    sessionId: activeChatSessionId,
    messages: nativeChatSession.messages,
    launchDraft: activeSessionTab?.launchDraft ?? null,
    launchDraftCreatedAt: activeSessionTab?.launchDraftCreatedAt ?? null,
    // Why: pass the raw draft plus this flag rather than nulling it off-chat —
    // a null is indistinguishable from a host retraction, and peeking at the
    // terminal view would permanently decline the prefill.
    chatActive: showNativeChat,
    transcriptLoading: nativeChatSession.transcriptLoading,
    transcriptSettled: nativeChatSession.status === 'ready',
    queuedCards: structuredNativeChat.queued.cards
  })

  const streaming = useMobileNativeChatStreamingState({
    structured: activeChatStructured,
    structuredWorking: structuredNativeChat.isWorking,
    terminalWorking: activeTabAgentWorking,
    resolved: activeChatResolution != null,
    status: nativeChatStatus
  })
  const nativeChatAgentWorking = streaming.agentWorking
  const promptScopeKey = mobileNativeChatScopeKey(hostId, worktreeId, activeSessionTabId)
  // Every chat write gates on both: the lease proves the input floor is ours, and
  // `connState` collapses a render before the lease does on disconnect.
  const inputSendable = activeChatStructured
    ? client != null && activeChatSessionId != null && connState === 'connected'
    : nativeChatInputLeaseReady && connState === 'connected'

  const nativeChatFiles = useMobileNativeChatFileSearch({ client, worktreeId })

  // Why: the send seam reports outgoing catalog commands to session-option
  // tracking, but the options hook needs the seam's dispatcher — a ref breaks
  // the cycle without re-creating the send callbacks per snapshot.
  const recordSessionOptionCommandRef = useRef<(command: string) => void>(() => {})

  const {
    prompts,
    askDismissal,
    promptWrites: bridgeWrites,
    messageSend: bridgeSend
  } = useMobileBridgeNativeChatLane({
    client,
    promptsEnabled: activeChatResolution != null && !activeChatStructured,
    writesEnabled: inputSendable && !activeChatStructured,
    status: nativeChatStatus,
    messages: nativeChatSession.messages,
    transcriptLoading: nativeChatSession.transcriptLoading,
    transcriptSettled:
      nativeChatSession.status === 'ready' ||
      (nativeChatSession.status === 'error' && nativeChatSession.messages.length > 0),
    chatVisible: showNativeChat,
    scopeKey: promptScopeKey,
    sessionId: activeChatSessionId,
    streamIdentity,
    handleRef: activeHandleRef,
    deviceTokenRef,
    agentRef: activeChatAgentRef,
    commandSendRef: recordSessionOptionCommandRef,
    captureSendOrigin,
    readSeededLaunchDraftSeed,
    clearDraftForSend,
    restoreRejectedDraft,
    acceptSend,
    holdUnconfirmedSend,
    onSendError
  })

  const prototypes = useMobileNativeChatPrototypeSurface({
    client,
    sessionId: activeChatStructured ? activeChatSessionId : null,
    worktreeId,
    scopeKey: promptScopeKey ?? '',
    agent: activeChatResolution?.agent,
    piRuntime: nativeChatPiRuntime,
    messages: nativeChatSession.messages,
    plainSend: structuredNativeChat.sendWithOutcome
  })
  const structuredNativeChatSend = useMobileStructuredNativeChatSendBridge({
    agent: activeChatResolution?.agent,
    resolvePrototype: prototypes.resolve,
    sendStructured: structuredNativeChat.sendWithOutcome,
    captureSendOrigin,
    clearDraftForSend,
    acceptSend,
    holdUnconfirmedSend,
    restoreRejectedDraft,
    onSendError
  })

  const { nativeChatSessionOptions, recordCommand: recordNativeChatSessionOptionCommand } =
    useMobileNativeChatSessionOptionController({
      client,
      activeChatStructured,
      activeSessionTabId,
      agent: activeChatResolution?.agent ?? null,
      dispatchCommand: bridgeSend.dispatchCommand,
      hostId,
      isTabChatView,
      isWorking: nativeChatAgentWorking,
      reportedModel: activeSessionTab?.agentStatus?.model ?? null,
      modelSwitchCommand: activeSessionTab?.agentStatus?.modelSwitchCommand,
      structured: {
        optionPickerRequest: structuredNativeChat.optionPickerRequest,
        conversationCommands: structuredNativeChat.conversationCommands,
        snapshot: structuredNativeChat.optionSnapshot,
        pendingId: structuredNativeChat.pendingOptionId,
        loading: structuredNativeChat.optionsLoading,
        setOption: structuredNativeChat.setStructuredOption,
        invokeAction: structuredNativeChat.invokeStructuredOption
      },
      toggleTabChatView,
      worktreeId
    })
  useLayoutEffect(() => {
    recordSessionOptionCommandRef.current = recordNativeChatSessionOptionCommand
    appendComposerTextRef.current = appendComposerText
    prototypes.composerSend.current = structuredNativeChatSend.sendWithOutcome
  }, [
    appendComposerText,
    prototypes.composerSend,
    recordNativeChatSessionOptionCommand,
    structuredNativeChatSend.sendWithOutcome
  ])
  // Card actions retire the route's held failure banner too, not just sends.
  const answerAsk = useNativeChatAcceptedAction(bridgeWrites.answerAsk, onSendResolved)
  const cancelAsk = useNativeChatAcceptedAction(bridgeWrites.cancelAsk, onSendResolved)
  const promptCards = useMobileNativeChatPromptCards({
    terminal: {
      permission: prompts.permission,
      question: prompts.question,
      waitStartedAt: nativeChatStatus?.stateStartedAt ?? null,
      scopeKey: promptScopeKey,
      sessionKey: streamIdentity,
      observing: showNativeChat && !activeChatStructured && nativeChatStatus != null,
      respondPermission: bridgeWrites.respondPermission,
      answerQuestion: bridgeSend.answerQuestion
    },
    structured: activeChatStructured ? structuredNativeChat : null,
    onSendResolved
  })

  return {
    isTabChatView,
    toggleTabChatView,
    showNativeChat,
    showNativeChatRef,
    nativeChatAgent: activeChatResolution?.agent ?? null,
    nativeChatPiRuntime,
    chatComposerText,
    setChatComposerText,
    getChatComposerEditGeneration,
    chatPending,
    chatImagePreviewsByMessageId,
    nativeChatSession,
    /** Structured lane: drives the per-turn status row and live tool progress. */
    nativeChatStructured: activeChatStructured,
    nativeChatVisualSource: activeChatStructured ? structuredNativeChat.visualSource : null,
    nativeChatAgentWorking,
    nativeChatTurnIndicator: activeChatStructured ? structuredNativeChat.turnIndicator : null,
    nativeChatWorkingStartedAt: activeChatStructured ? structuredNativeChat.workingStartedAt : null,
    nativeChatSettledTurns: activeChatStructured ? structuredNativeChat.settledTurns : null,
    nativeChatTurnJournal: activeChatStructured ? structuredNativeChat.turnJournal : null,
    // Only the structured lane names a refusal's cause; the bridge lane's starved ones drop none.
    nativeChatCommandRefusalCauses: structuredNativeChat.commandRefusalCauses,
    nativeChatCanStop: activeChatStructured
      ? structuredNativeChat.turnId !== null
      : nativeChatAgentWorking,
    nativeChatStreamingText: streaming.text,
    nativeChatStreamLive: streaming.live,
    nativeChatStreamScopeKey: streamScopeKey,
    ...promptCards,
    nativeChatAsk:
      !activeChatStructured && (askDismissal.showAsk || askDismissal.collapsedAsk)
        ? prompts.ask
        : null,
    nativeChatAskKey: askDismissal.askKey,
    dismissNativeChatAsk: askDismissal.dismissAsk,
    collapseNativeChatAsk: askDismissal.collapseAsk,
    nativeChatCollapsedPrompt: askDismissal.collapsedAsk ?? promptCards.nativeChatCollapsedPrompt,
    handleNativeChatAnswerAsk: answerAsk,
    handleNativeChatCancelAsk: cancelAsk,
    handleNativeChatStop: activeChatStructured ? structuredNativeChat.cancel : bridgeWrites.stop,
    // The inactive lane's session is starved of identity, so its cards stay empty.
    nativeChatQueued: structuredNativeChat.queued,
    nativeChatBackgroundTasks: activeChatStructured ? structuredNativeChat.backgroundTasks : null,
    ...nativeChatFiles,
    handleNativeChatSend: activeChatStructured ? structuredNativeChatSend.send : bridgeSend.send,
    handleNativeChatSendWithOutcome: activeChatStructured
      ? structuredNativeChatSend.sendWithOutcome
      : bridgeSend.sendWithOutcome,
    ...prototypes.fields,
    readSeededLaunchDraft,
    nativeChatSessionOptions
  }
}
