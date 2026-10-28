import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { MessageSquare, Plus, SquareTerminal, X } from 'lucide-react-native'
import { useBackClaim } from '../navigation/use-back-claim'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MobileTerminalPaneStack } from './MobileTerminalPaneStack'
import {
  newTerminalTabId,
  terminalPanelPills,
  terminalPanelTitle,
  terminalTabsOf,
  type TerminalPanelPill
} from './mobile-terminal-panel-model'
import type { MobileSessionController } from './use-mobile-session-controller'

/**
 * The Terminal panel: the worktree's terminals as pills, the selected one's pane below, and "New
 * terminal" always in reach. It takes the session body in place of the transcript, on every layout,
 * and the device Back key returns to the chat.
 */
export function MobileTerminalPanel({
  controller,
  topInset
}: {
  controller: MobileSessionController
  /** Where the floating controls end, so the panel starts beneath them. */
  topInset: number
}) {
  const {
    visibleTabs,
    activeSessionTabId,
    switchSessionTab,
    handleCreateTerminal,
    handleCloseSessionTab,
    showLoadingState,
    returnToChat
  } = controller
  const [freshTabId, setFreshTabId] = useState<string | null>(null)
  // The terminals that existed when a create was asked; the one that lands beyond them is fresh.
  const awaitingCreateRef = useRef<ReadonlySet<string> | null>(null)
  useEffect(() => {
    const known = awaitingCreateRef.current
    if (known === null) {
      return
    }
    const created = newTerminalTabId(known, visibleTabs)
    if (created !== null) {
      awaitingCreateRef.current = null
      setFreshTabId(created)
    }
  }, [visibleTabs])
  useBackClaim(() => {
    returnToChat()
    return true
  })

  const onNewTerminal = () => {
    awaitingCreateRef.current = new Set(terminalTabsOf(visibleTabs).map((tab) => tab.id))
    void handleCreateTerminal()
  }
  const pills = terminalPanelPills({
    tabs: visibleTabs,
    selectedTabId: activeSessionTabId,
    freshTabId
  })
  const selected = pills.find((pill) => pill.selected) ?? null
  const hasTerminals = pills.length > 0

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{terminalPanelTitle(pills.length)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New terminal"
          hitSlop={spacing.xs}
          onPress={onNewTerminal}
          style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
        >
          <Plus size={15} color={colors.bgBase} strokeWidth={2.4} />
          <Text style={styles.newButtonText}>New terminal</Text>
        </Pressable>
      </View>
      {showLoadingState ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : !hasTerminals ? (
        <View style={styles.centered}>
          <SquareTerminal size={40} color={colors.textMuted} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>No terminal in this worktree</Text>
          <Text style={styles.emptyBody}>Open a shell to run commands next to your sessions.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onNewTerminal}
            style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
          >
            <Text style={styles.openButtonText}>Open terminal</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillScroll}
            contentContainerStyle={styles.pillRow}
          >
            {pills.map((pill) => (
              <TerminalPill
                key={pill.id}
                pill={pill}
                onPick={() => switchSessionTab(pill.tab)}
                onClose={() => void handleCloseSessionTab(pill.tab)}
              />
            ))}
          </ScrollView>
          <View style={styles.body}>
            <MobileTerminalPaneStack controller={controller} />
            {selected?.pending ? (
              <View style={styles.pendingOverlay}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.emptyBody}>Starting terminal…</Text>
              </View>
            ) : null}
            {selected?.fresh && !selected.pending ? (
              <View style={styles.readyLine}>
                <Text style={styles.readyText}>Ready — type a command</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to chat"
          onPress={returnToChat}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MessageSquare size={16} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.backText}>Back to chat</Text>
        </Pressable>
      </View>
    </View>
  )
}

function TerminalPill({
  pill,
  onPick,
  onClose
}: {
  pill: TerminalPanelPill
  onPick: () => void
  onClose: () => void
}) {
  // On the selected pill's light fill the amber and blue tags would lose contrast, so they go dark.
  const onSelected = pill.selected
  return (
    <View style={[styles.pillWrap, onSelected && styles.pillWrapSelected]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: pill.selected }}
        accessibilityLabel={pill.label}
        onPress={onPick}
        style={styles.pill}
      >
        <SquareTerminal
          size={14}
          color={onSelected ? colors.bgBase : colors.textSecondary}
          strokeWidth={2}
        />
        <Text numberOfLines={1} style={[styles.pillLabel, onSelected && styles.pillLabelSelected]}>
          {pill.label}
        </Text>
        {pill.agentPane ? (
          <Text style={[styles.tag, { color: onSelected ? colors.bgBase : colors.statusAmber }]}>
            Agent · terminal
          </Text>
        ) : null}
        {pill.fresh ? (
          <Text
            style={[styles.freshTag, { color: onSelected ? colors.bgBase : colors.accentBlue }]}
          >
            new
          </Text>
        ) : null}
      </Pressable>
      {onSelected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${pill.label}`}
          hitSlop={spacing.xs}
          onPress={onClose}
          style={styles.closeButton}
        >
          <X size={12} color={colors.bgBase} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  title: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    letterSpacing: 1
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.textPrimary
  },
  newButtonText: {
    color: colors.bgBase,
    fontSize: typography.bodySize - 1,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.8
  },
  pillScroll: {
    flexGrow: 0
  },
  pillRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  pillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pillWrapSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 34,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm
  },
  pillLabel: {
    maxWidth: 160,
    color: colors.textSecondary,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize - 1
  },
  pillLabelSelected: {
    color: colors.bgBase
  },
  tag: {
    fontSize: typography.metaSize - 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.statusAmber,
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1
  },
  freshTag: {
    fontSize: typography.metaSize - 1
  },
  closeButton: {
    width: 24,
    height: 24,
    marginRight: spacing.xs,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    flex: 1,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    overflow: 'hidden'
  },
  pendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgBase
  },
  readyLine: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    backgroundColor: colors.bgPanel
  },
  readyText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize + 3,
    fontWeight: '600'
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    lineHeight: 20,
    textAlign: 'center'
  },
  openButton: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary
  },
  openButtonText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bgRaised
  },
  backText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize - 1
  }
})
