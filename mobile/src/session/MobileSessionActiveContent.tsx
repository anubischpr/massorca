import { useContext, useEffect, useRef } from 'react'
import type { TerminalFrame } from '../terminal/terminal-webview-messages'
import { Animated, View, Text, Pressable, ActivityIndicator } from 'react-native'
import { MobileBrowserPane } from '../browser/MobileBrowserPane'
import { MobileNativeChatOverlay } from './MobileNativeChatOverlay'
import { MobileTerminalPaneStack } from './MobileTerminalPaneStack'
import { MobileTerminalPanel } from './MobileTerminalPanel'
import { MobileSessionUnsupportedNotice } from './MobileSessionUnsupportedNotice'
import { MOBILE_LEGACY_SESSION_VIEWS } from './mobile-legacy-session-views'
import { MobileChatChromeLayoutContext, mobileChatContentTop } from './mobile-chat-chrome-layout'
import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileDelegatedChildContext } from './mobile-delegated-child-access'
import { FileReader } from './MobileSessionFileReader'
import { MarkdownReader } from './MobileSessionMarkdownReader'

export function MobileSessionActiveContent({
  controller
}: {
  controller: MobileSessionController
}) {
  const chromeLayout = useContext(MobileChatChromeLayoutContext)
  const {
    worktreeId,
    insets,
    showSessionSwitcherChip,
    openArtifactViewer,
    openPrototypeSettings,
    openPrototypeSet,
    connState,
    client,
    markdownDocs,
    fileDocs,
    diffComments,
    diffCommentBusy,
    createError,
    setCreateError,
    setShowCreateTabDrawer,
    dictationMode,
    toastMessage,
    browserScreencastSupported,
    showToast,
    nativeChatSendError,
    nativeChatOverlayInputLockReason,
    nativeChatController,
    nativeChatBridgeBackground,
    dictation,
    handleDictationToggle,
    handleDictationPressIn,
    handleDictationPressOut,
    readMarkdownTab,
    addDiffCommentForFile,
    deleteDiffCommentForFile,
    copyDiffCommentsToClipboard,
    sendDiffCommentsToAgent,
    sendingDiffCommentIds,
    updateMarkdownLocalContent,
    copyMarkdownLocalContent,
    discardMarkdownLocalContent,
    saveMarkdownTab,
    notifyTerminalFrame,
    handleNativeChatFileTap,
    nativeChatImages,
    activeMarkdownTab,
    activeFileTab,
    activeBrowserTab,
    activePendingTerminalTab,
    isPendingTerminalRecoveryParked,
    retryPendingTerminalRecovery,
    terminalPanelOpen,
    showLoadingState,
    showEmptyState,
    showUnsupportedNotice,
    keyboardLift,
    toastAnimatedStyle,
    createTabBusy
  } = controller
  const { delegatedChildren } = controller
  const content = terminalPanelOpen ? (
    <MobileTerminalPanel
      controller={controller}
      topInset={mobileChatContentTop(chromeLayout.height, insets.top)}
    />
  ) : showLoadingState ? (
    <View style={styles.emptyState}>
      <ActivityIndicator size="small" color={colors.textSecondary} />
    </View>
  ) : showEmptyState ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No tabs in this session</Text>
      {createError ? <Text style={styles.createError}>{createError}</Text> : null}
      <View style={styles.emptyActions}>
        <Pressable
          style={[
            styles.createButton,
            (createTabBusy || connState !== 'connected') && styles.createButtonDisabled
          ]}
          disabled={createTabBusy || connState !== 'connected'}
          onPress={() => {
            setCreateError('')
            setShowCreateTabDrawer(true)
          }}
        >
          <Text style={styles.createButtonText}>
            {createTabBusy ? 'Creating...' : 'Create Tab'}
          </Text>
        </Pressable>
      </View>
    </View>
  ) : showUnsupportedNotice ? (
    <MobileSessionUnsupportedNotice controller={controller} />
  ) : activeMarkdownTab ? (
    <View style={styles.markdownFrame}>
      <MarkdownReader
        documentId={activeMarkdownTab.id}
        doc={markdownDocs.get(activeMarkdownTab.id)}
        onRefresh={() => void readMarkdownTab(activeMarkdownTab)}
        onChange={(content) => updateMarkdownLocalContent(activeMarkdownTab.id, content)}
        onSave={() => void saveMarkdownTab(activeMarkdownTab)}
        onCopy={() => void copyMarkdownLocalContent(activeMarkdownTab.id)}
        onDiscard={() => discardMarkdownLocalContent(activeMarkdownTab)}
        keyboardLift={keyboardLift}
      />
      {toastMessage && (
        <Animated.View pointerEvents="none" style={[styles.toast, toastAnimatedStyle]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  ) : activeFileTab ? (
    <View style={styles.markdownFrame}>
      <FileReader
        client={client}
        doc={fileDocs.get(activeFileTab.id)}
        title={activeFileTab.title || 'File'}
        relativePath={activeFileTab.relativePath}
        language={activeFileTab.language}
        diffCommentActions={
          activeFileTab.diffSource === 'staged' || activeFileTab.diffSource === 'unstaged'
            ? {
                comments: diffComments,
                sendingCommentIds: sendingDiffCommentIds,
                busy: diffCommentBusy,
                onAdd: addDiffCommentForFile,
                onDelete: deleteDiffCommentForFile,
                onCopyAll: copyDiffCommentsToClipboard,
                onSendAll: sendDiffCommentsToAgent
              }
            : undefined
        }
      />
      {toastMessage && (
        <Animated.View pointerEvents="none" style={[styles.toast, toastAnimatedStyle]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  ) : activeBrowserTab ? (
    <View style={styles.browserFrame}>
      {/* Why: pane owns imperative frame refs; don't render a stale frame while the old stream effect cleans up. */}
      <MobileBrowserPane
        key={activeBrowserTab.browserPageId ?? activeBrowserTab.id}
        client={client}
        worktreeId={worktreeId}
        tab={activeBrowserTab}
        screencastSupported={browserScreencastSupported}
        keyboardLift={keyboardLift}
        bottomInset={insets.bottom}
        onToast={showToast}
      />
      {toastMessage && (
        <Animated.View pointerEvents="none" style={[styles.toast, toastAnimatedStyle]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  ) : activePendingTerminalTab ? (
    <View style={styles.emptyState}>
      {!isPendingTerminalRecoveryParked && (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      )}
      <Text style={styles.emptyText}>
        {isPendingTerminalRecoveryParked
          ? 'Terminal is taking longer than expected'
          : activePendingTerminalTab.title || 'Loading terminal'}
      </Text>
      {isPendingTerminalRecoveryParked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading terminal"
          style={({ pressed }) => [styles.createButton, pressed && styles.newTerminalButtonPressed]}
          onPress={() => void retryPendingTerminalRecovery()}
        >
          <Text style={styles.createButtonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  ) : (
    <View style={styles.terminalFrame}>
      {MOBILE_LEGACY_SESSION_VIEWS ? <MobileTerminalPaneStack controller={controller} /> : null}
      <MobileDelegatedChildContext.Provider value={delegatedChildren}>
        <MobileNativeChatOverlay
          controller={nativeChatController}
          bridgeBackground={nativeChatBridgeBackground}
          onOpenFile={handleNativeChatFileTap}
          images={nativeChatImages}
          onMicPress={handleDictationToggle}
          micActive={dictation.isRecording}
          dictationMode={dictationMode}
          onMicPressIn={handleDictationPressIn}
          onMicPressOut={handleDictationPressOut}
          inputLockReason={nativeChatOverlayInputLockReason}
          sendErrorMessage={nativeChatSendError.message}
          onClearSendError={nativeChatSendError.clear}
          sendSurfaceId={controller.nativeChatScopeKey ?? ''}
          getSendCompletionGeneration={controller.getSendCompletionGeneration}
          keyboardInset={keyboardLift}
          chromeTopInset={
            showSessionSwitcherChip ? mobileChatContentTop(chromeLayout.height, insets.top) : 0
          }
          onOpenArtifact={openArtifactViewer}
          onOpenPrototypeSettings={openPrototypeSettings}
          onOpenPrototypeSet={openPrototypeSet}
        />
      </MobileDelegatedChildContext.Provider>
      {toastMessage && (
        <Animated.View pointerEvents="none" style={[styles.toast, toastAnimatedStyle]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  )
  const contentFrameRef = useRef<TerminalFrame | null>(null)
  const panelOpenRef = useRef(terminalPanelOpen)
  // Why: closing the panel hands the frame back to this layout, which may not change size to report again.
  useEffect(() => {
    const wasOpen = panelOpenRef.current
    panelOpenRef.current = terminalPanelOpen
    if (wasOpen && !terminalPanelOpen && contentFrameRef.current) {
      notifyTerminalFrame(contentFrameRef.current)
    }
  }, [notifyTerminalFrame, terminalPanelOpen])
  return (
    <View
      // Why: one frame under every branch; react-native-web observes onLayout only on a View that mounts with it.
      style={styles.contentFrame}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        contentFrameRef.current = { width, height }
        // Why: the Terminal panel reports the body its terminal fills; this frame also holds its header, pills and footer.
        if (!terminalPanelOpen) {
          notifyTerminalFrame({ width, height })
        }
      }}
    >
      {content}
    </View>
  )
}
