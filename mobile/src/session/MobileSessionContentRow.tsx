import { useContext } from 'react'
import { View, Text, Pressable } from 'react-native'
import { AlertTriangle, X } from 'lucide-react-native'
import { SessionDockColumn } from './SessionDockColumn'
import { dismissMobileSessionCreateWarningState } from './mobile-session-create-warning-state'
import { colors } from '../theme/mobile-theme'
import { styles } from './mobile-session-styles'
import type { MobileSessionController } from './use-mobile-session-controller'
import { MobileSessionActiveContent } from './MobileSessionActiveContent'
import { MobileSessionCommandDock } from './MobileSessionCommandDock'
import { MobileChatFloatingChrome } from './MobileChatFloatingChrome'
import { MobileChatChromeLayoutContext } from './mobile-chat-chrome-layout'

export function MobileSessionContentRow({ controller }: { controller: MobileSessionController }) {
  const {
    hostId,
    worktreeId,
    worktreeName,
    activePanel,
    setActivePanel,
    sessionContentRowWidth,
    canDockPanel,
    setCreateWarningState,
    createWarning,
    handleFileOpenStart,
    handleOpenedFileDiff,
    handleSessionContentRowLayout,
    showSessionSwitcherChip
  } = controller
  // The floating controls cover the top of this column; the banner starts beneath them.
  const chromeLayout = useContext(MobileChatChromeLayoutContext)
  return (
    <View style={styles.sessionContentRow} onLayout={handleSessionContentRowLayout}>
      <View style={styles.sessionContentMain}>
        {showSessionSwitcherChip ? <MobileChatFloatingChrome controller={controller} /> : null}
        {createWarning ? (
          <View style={[styles.createWarningBanner, { marginTop: chromeLayout.height }]}>
            <AlertTriangle size={16} color={colors.statusAmber} strokeWidth={2.2} />
            <Text style={styles.createWarningText}>{createWarning}</Text>
            <Pressable
              style={styles.createWarningDismiss}
              onPress={() => setCreateWarningState(dismissMobileSessionCreateWarningState)}
              accessibilityLabel="Dismiss workspace creation warning"
              hitSlop={8}
            >
              <X size={16} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : null}
        <MobileSessionActiveContent controller={controller} />
        {/* Why: translate instead of resize so keyboard toggles don't trigger a server-side PTY viewport change. */}
        <MobileSessionCommandDock controller={controller} />
      </View>
      {canDockPanel && activePanel !== null && (
        <SessionDockColumn
          activePanel={activePanel}
          hostId={hostId}
          worktreeId={worktreeId}
          name={worktreeName || ''}
          availableWidth={sessionContentRowWidth}
          onRequestClose={() => setActivePanel(null)}
          onFileOpenStart={handleFileOpenStart}
          onOpenedFileDiff={handleOpenedFileDiff}
        />
      )}
    </View>
  )
}
