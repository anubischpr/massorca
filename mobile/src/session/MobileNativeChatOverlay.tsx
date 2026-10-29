import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import { MobileNativeChatView, type MobileNativeChatInputLockReason } from './MobileNativeChatView'
import { foldMobileNativeChatMessages } from './mobile-native-chat-render-data'
import { mobileChatTurnArtifactCards } from './mobile-chat-turn-artifacts'
import { MobileChatTurnArtifacts } from './MobileChatInlineArtifactCard'
import type { MobileArtifactTarget } from './mobile-chat-artifacts-model'
import type { MobileNativeChatImageAttachments } from './use-mobile-native-chat-image-attachments'
import type { MobileNativeChatController } from './use-mobile-native-chat-controller'
import { useMobileNativeChatStreamingBubble } from './use-mobile-native-chat-streaming-bubble'
import { useMobileNativeChatComposerTray } from './use-mobile-native-chat-composer-tray'
import { useMobileNativeChatVisualRenderer } from './MobileNativeChatVisual'
import { MobileNativeChatVisualContext } from './mobile-native-chat-visual-context'
import {
  MobileDelegatedChildrenContext,
  useDelegatedChildrenFromJournal
} from './mobile-delegated-child-rows'
import { MobilePrototypeCountCard } from '../prototypes/MobilePrototypeCountCard'
import { MobilePrototypeRequestLink } from '../prototypes/MobilePrototypeRequestLink'
import { matchPrototypeSetsToUserTurns } from '../prototypes/mobile-prototype-request-links'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

type Props = {
  controller: MobileNativeChatController
  /** Terminal-backed chat: the pane's status row and whether the host is heard; null otherwise. */
  bridgeBackground?: { status: AgentStatusEntry | null; connected: boolean } | null
  /** Opens a tapped file reference (worktree-relative or absolute, optional
   *  :line(:col) suffix) through the shared tap-to-open flow. */
  onOpenFile: (pathText: string) => void
  /** Native-chat image attachments: picking adds a composer chip, and sending
   *  rides the pending images along with the message text (desktop parity). */
  images: MobileNativeChatImageAttachments
  onMicPress: () => void
  micActive: boolean
  dictationMode: string | undefined
  onMicPressIn: () => void
  onMicPressOut: () => void
  inputLockReason: MobileNativeChatInputLockReason | null
  /** Latest send failure, rendered inline above the composer. */
  sendErrorMessage: string | null
  /** Drops that failure once a later send succeeds. */
  onClearSendError: () => void
  /** Stable host/worktree/tab identity for accepted-send completion fencing. */
  sendSurfaceId: string
  /** Reads the retained route's focus generation for accepted-send fencing. */
  getSendCompletionGeneration: () => number
  keyboardInset: number
  /** Space the transcript leaves beneath the floating session controls. */
  chromeTopInset?: number
  /** Opens a page a turn wrote or showed, from its inline card. */
  onOpenArtifact?: (target: MobileArtifactTarget) => void
  /** Opens Settings › Prototypes, from the "How many prototypes?" card. */
  onOpenPrototypeSettings?: () => void
  /** Opens the set a prototype request made, from the link card under that request. */
  onOpenPrototypeSet?: (set: PrototypeListedSet) => void
}

/** Keeps the terminal mounted underneath chat so its PTY subscription survives
 *  view toggles while the native surface owns the visible composer. Also owns
 *  the streaming gate: this component stays mounted across those toggles, while
 *  the chat list below it does not. */
export function MobileNativeChatOverlay({
  controller,
  bridgeBackground,
  onOpenFile,
  images,
  onMicPress,
  micActive,
  dictationMode,
  onMicPressIn,
  onMicPressOut,
  inputLockReason,
  sendErrorMessage,
  onClearSendError,
  sendSurfaceId,
  getSendCompletionGeneration,
  keyboardInset,
  chromeTopInset,
  onOpenArtifact,
  onOpenPrototypeSettings,
  onOpenPrototypeSet
}: Props): React.JSX.Element | null {
  const session = controller.nativeChatSession
  const folded = useMemo(() => foldMobileNativeChatMessages(session.messages), [session.messages])
  const artifactCards = useMemo(() => mobileChatTurnArtifactCards(folded), [folded])
  const artifactSource = controller.nativeChatVisualSource
  const prototypeSessionId = controller.nativeChatPrototypeSend?.sessionId ?? null
  const prototypeSets = controller.nativeChatPrototypeSets
  const prototypeLinks = useMemo(
    () =>
      prototypeSessionId === null
        ? new Map<string, PrototypeListedSet>()
        : matchPrototypeSetsToUserTurns(prototypeSets, folded, prototypeSessionId),
    [folded, prototypeSessionId, prototypeSets]
  )
  const renderTurnArtifacts = useMemo(
    () =>
      onOpenArtifact || onOpenPrototypeSet
        ? (messageId: string) => {
            const pages = onOpenArtifact ? artifactCards.get(messageId) : undefined
            const link = onOpenPrototypeSet ? prototypeLinks.get(messageId) : undefined
            return pages || link ? (
              <>
                {pages && onOpenArtifact ? (
                  <MobileChatTurnArtifacts
                    pages={pages}
                    source={artifactSource}
                    onOpen={onOpenArtifact}
                  />
                ) : null}
                {link && onOpenPrototypeSet ? (
                  <MobilePrototypeRequestLink set={link} onOpen={onOpenPrototypeSet} />
                ) : null}
              </>
            ) : null
          }
        : undefined,
    [artifactCards, artifactSource, onOpenArtifact, onOpenPrototypeSet, prototypeLinks]
  )
  const streaming = useMobileNativeChatStreamingBubble(
    folded,
    controller.nativeChatStreamingText,
    controller.nativeChatStreamScopeKey,
    controller.nativeChatStreamLive
  )
  const queued = controller.nativeChatQueued
  const composerTray = useMobileNativeChatComposerTray({
    queued: {
      cards: queued.cards,
      onSend: queued.send,
      onDelete: queued.delete,
      onEdit: queued.edit,
      pause: queued.pause,
      onResume: queued.resume,
      sessionKey: queued.sessionKey,
      // Nothing steers into a turn a Stop is ending; the host holds such a send until it ends.
      // The indicator's `stopping` is the display status, decided once in the session hook.
      steerHeld: controller.nativeChatTurnIndicator?.stopping === true
    },
    backgroundTasks: controller.nativeChatBackgroundTasks,
    turn: {
      working: controller.nativeChatAgentWorking,
      startedAt: controller.nativeChatWorkingStartedAt
    }
  })
  const visuals = useMobileNativeChatVisualRenderer(controller.nativeChatVisualSource)
  const delegatedChildren = useDelegatedChildrenFromJournal(
    controller.nativeChatTurnJournal?.items,
    controller.nativeChatBackgroundTasks?.rowContext.hostClockOffsetMs ?? 0
  )
  if (!controller.showNativeChat) {
    return null
  }
  return (
    <View style={styles.overlay}>
      <MobileDelegatedChildrenContext.Provider value={delegatedChildren}>
        <MobileNativeChatVisualContext.Provider value={visuals}>
          <MobileNativeChatView
            messages={session.messages}
            folded={folded}
            status={session.status}
            error={session.error}
            readFailedFinally={session.readFailedFinally === true}
            agent={controller.nativeChatAgent}
            piRuntime={controller.nativeChatPiRuntime}
            agentWorking={controller.nativeChatAgentWorking}
            bridgeBackground={bridgeBackground ?? undefined}
            canStop={controller.nativeChatCanStop}
            structuredActivityUi={controller.nativeChatStructured}
            turnIndicator={controller.nativeChatTurnIndicator}
            workingStartedAt={controller.nativeChatWorkingStartedAt}
            settledTurns={controller.nativeChatSettledTurns}
            turnJournal={controller.nativeChatTurnJournal}
            streaming={streaming}
            onStop={controller.handleNativeChatStop}
            ask={controller.nativeChatAsk}
            askKey={controller.nativeChatAskKey}
            promptKey={controller.nativeChatPromptKey}
            onDismissAsk={controller.dismissNativeChatAsk}
            onAnswerAsk={controller.handleNativeChatAnswerAsk}
            onCancelAsk={controller.handleNativeChatCancelAsk}
            onCancelPrompt={controller.handleNativeChatCancelPrompt}
            onCollapseAsk={controller.collapseNativeChatAsk}
            onCollapsePrompt={controller.collapseNativeChatPrompt}
            collapsedPrompt={controller.nativeChatCollapsedPrompt}
            question={controller.nativeChatQuestion}
            onAnswerQuestion={controller.handleNativeChatQuestionAnswer}
            permission={controller.nativeChatPermission}
            onRespondPermission={controller.handleNativeChatRespondPermission}
            composerTray={composerTray}
            onOpenFile={onOpenFile}
            hasMore={session.hasMore}
            loadingEarlier={session.loadingEarlier}
            onLoadEarlier={session.loadEarlier}
            onSend={images.sendNativeChat}
            sendSurfaceId={sendSurfaceId}
            getSendCompletionGeneration={getSendCompletionGeneration}
            getComposerEditGeneration={controller.getChatComposerEditGeneration}
            pending={controller.chatPending}
            imagePreviewsByMessageId={controller.chatImagePreviewsByMessageId}
            composerText={controller.chatComposerText}
            onComposerTextChange={controller.setChatComposerText}
            onAttachImage={() => void images.attachImage('library')}
            attachments={images.attachments}
            onRemoveAttachment={images.removeAttachment}
            isAttaching={images.isAttaching}
            onMicPress={onMicPress}
            micActive={micActive}
            dictationMode={dictationMode}
            onMicPressIn={onMicPressIn}
            onMicPressOut={onMicPressOut}
            inputLockReason={inputLockReason}
            sendErrorMessage={sendErrorMessage}
            onClearSendError={onClearSendError}
            filePaths={controller.nativeChatFilePaths}
            onNeedFiles={controller.loadNativeChatFiles}
            sessionOptions={controller.nativeChatSessionOptions}
            keyboardInset={keyboardInset}
            topInset={chromeTopInset}
            renderTurnArtifacts={renderTurnArtifacts}
            prototypeCard={
              controller.nativeChatPrototypeAsk && onOpenPrototypeSettings ? (
                <MobilePrototypeCountCard
                  ask={controller.nativeChatPrototypeAsk}
                  onChoose={controller.answerNativeChatPrototypeAsk}
                  onOpenSettings={onOpenPrototypeSettings}
                />
              ) : null
            }
          />
        </MobileNativeChatVisualContext.Provider>
      </MobileDelegatedChildrenContext.Provider>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: StyleSheet.absoluteFillObject
})
