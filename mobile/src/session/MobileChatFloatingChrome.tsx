import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Folder, GitBranch, MessageSquare, MoreHorizontal } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { MobileSessionSwitcherChip } from './MobileSessionSwitcherChip'
import {
  mobileChatChromeSegmentPanel,
  resolveMobileChatChromeSegments,
  type MobileChatChromeSegmentId
} from './mobile-chat-chrome-segments'
import { useMobileStructuredPiRuntimeVersion } from './mobile-structured-pi-runtime-record'
import type { MobileSessionController } from './use-mobile-session-controller'

const BAR_TOP = spacing.lg

const SEGMENT_ICONS = {
  chat: MessageSquare,
  files: Folder,
  sourceControl: GitBranch
} as const

/**
 * The chat's floating controls over the transcript, which runs edge to edge beneath them: back,
 * the Chat / Files / Source control segments, the ⋯ menu, and the session chip.
 */
export function MobileChatFloatingChrome({ controller }: { controller: MobileSessionController }) {
  const {
    requestLeaveSession,
    activePanel,
    setActivePanel,
    handlePanelTap,
    isFolderWorkspaceRoute,
    isFloatingWorkspaceRoute,
    showHeaderMoreButton,
    setShowHeaderMoreActions,
    activeSessionRow,
    sessionRows,
    openSessionsSheet
  } = controller
  const insets = useSafeAreaInsets()
  // The header this replaces held the subscription that names a Gentle Shell tab; keep it mounted.
  useMobileStructuredPiRuntimeVersion()
  const segments = resolveMobileChatChromeSegments({
    activePanel,
    showFiles: !isFloatingWorkspaceRoute,
    showSourceControl: !isFolderWorkspaceRoute && !isFloatingWorkspaceRoute
  })

  const selectSegment = (id: MobileChatChromeSegmentId) => {
    const panel = mobileChatChromeSegmentPanel(id)
    if (panel) {
      handlePanelTap(panel)
    } else if (activePanel !== null) {
      setActivePanel(null)
    }
  }

  return (
    <View pointerEvents="box-none" style={[styles.layer, { paddingTop: insets.top + BAR_TOP }]}>
      <View style={styles.bar}>
        <FloatingRound
          label="Back to worktrees"
          onPress={requestLeaveSession}
          icon={<ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.2} />}
        />
        <View style={styles.segments} accessibilityRole="tablist">
          {segments.map((segment) => {
            const Icon = SEGMENT_ICONS[segment.id]
            return (
              <Pressable
                key={segment.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: segment.active }}
                accessibilityLabel={segment.label}
                onPress={() => selectSegment(segment.id)}
                style={[styles.segment, segment.active && styles.segmentActive]}
              >
                <Icon
                  size={19}
                  color={segment.active ? colors.textPrimary : colors.textSecondary}
                  strokeWidth={2}
                />
              </Pressable>
            )
          })}
        </View>
        {showHeaderMoreButton ? (
          <FloatingRound
            label="More session actions"
            onPress={() => setShowHeaderMoreActions(true)}
            icon={<MoreHorizontal size={20} color={colors.textPrimary} strokeWidth={2.2} />}
          />
        ) : (
          <View style={styles.roundSpacer} />
        )}
      </View>
      <View style={styles.chipRow}>
        <MobileSessionSwitcherChip
          activeRow={activeSessionRow}
          tabCount={sessionRows.length}
          onPress={openSessionsSheet}
        />
      </View>
    </View>
  )
}

function FloatingRound({
  label,
  icon,
  onPress
}: {
  label: string
  icon: React.ReactNode
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  )
}

const glass: ViewStyle = {
  backgroundColor: colors.bgPanel,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.borderSubtle
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg - 2,
    zIndex: 10
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass
  },
  roundSpacer: {
    width: 46,
    height: 46
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: 999,
    ...glass
  },
  segment: {
    width: 60,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentActive: {
    backgroundColor: colors.bgRaised
  },
  chipRow: {
    alignItems: 'center',
    marginTop: spacing.sm + spacing.xs
  }
})
