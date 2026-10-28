import { type ComponentType, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Files, GitBranch, ListChecks, ListTodo, ScrollText, Zap } from 'lucide-react-native'
import { MobileAgentSessionHistoryIcon } from '../agent-history/MobileAgentSessionHistoryIcon'
import { BottomDrawer } from '../components/BottomDrawer'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { MobileSessionHeaderMenu } from './mobile-session-header-menu'

/** The reason a chat item shows disabled when the worktree has no chat to act on. */
const NO_CHAT_HINT = 'Start a chat first'

type MenuIconProps = { size: number; color: string; strokeWidth: number }

type MenuItem = {
  show: boolean
  key: string
  label: string
  hint?: string
  icon: ComponentType<MenuIconProps>
  onPress: () => void
  disabled?: boolean
}

type Props = {
  visible: boolean
  menu: MobileSessionHeaderMenu
  /** "2 of 5 done" on the plan row; absent when the chat has no plan. */
  planHint?: string
  recordedFileCount: number
  onOpenPlan: () => void
  onOpenSummary: () => void
  onOpenArtifacts: () => void
  onOpenQuickCommands: () => void
  /** A create is pending or the host is not connected: quick commands wait, as the tab button did. */
  quickCommandsDisabled?: boolean
  onOpenAgentHistory: () => void
  onOpenBranch: () => void
  onOpenChecks: () => void
  onClose: () => void
}

/** The ⋯ menu: the chat's surfaces first, then the workspace's environment. Each choice runs after
 *  the menu has closed, so the sheet it opens never stacks on this one's native modal. */
export function MobileSessionHeaderMoreActionsSheet({
  visible,
  menu,
  planHint,
  recordedFileCount,
  onOpenPlan,
  onOpenSummary,
  onOpenArtifacts,
  onOpenQuickCommands,
  quickCommandsDisabled = false,
  onOpenAgentHistory,
  onOpenBranch,
  onOpenChecks,
  onClose
}: Props) {
  const afterCloseRef = useRef<(() => void) | null>(null)
  const pick = (item: MenuItem) => {
    afterCloseRef.current = item.onPress
    onClose()
  }
  // Plan, Summary and Artifacts act on the worktree's chat: without one they stay listed, disabled.
  const noChat = !menu.hasChatSession
  const chatItems = shown([
    {
      show: menu.chat.plan,
      key: 'plan',
      label: 'Plan',
      hint: noChat ? NO_CHAT_HINT : planHint,
      icon: ListTodo,
      onPress: onOpenPlan,
      disabled: noChat
    },
    {
      show: menu.chat.summary,
      key: 'summary',
      label: 'Summary',
      hint: noChat ? NO_CHAT_HINT : undefined,
      icon: ScrollText,
      onPress: onOpenSummary,
      disabled: noChat
    },
    {
      show: menu.chat.artifacts,
      key: 'artifacts',
      label: 'Artifacts',
      hint: noChat ? NO_CHAT_HINT : String(recordedFileCount),
      icon: Files,
      onPress: onOpenArtifacts,
      disabled: noChat
    },
    {
      show: menu.chat.quickCommands,
      key: 'quick-commands',
      label: 'Quick commands',
      icon: Zap,
      onPress: onOpenQuickCommands,
      disabled: quickCommandsDisabled
    },
    {
      show: menu.chat.agentHistory,
      key: 'agent-history',
      label: 'Agent history',
      hint: 'Browse and resume agent sessions',
      icon: MobileAgentSessionHistoryIcon,
      onPress: onOpenAgentHistory
    }
  ])
  const environmentItems = shown([
    {
      show: menu.environment.branch,
      key: 'branch',
      label: 'Branch',
      hint: 'Source control',
      icon: GitBranch,
      onPress: onOpenBranch
    },
    {
      show: menu.environment.checks,
      key: 'checks',
      label: 'Checks',
      hint: 'Open pull request checks',
      icon: ListChecks,
      onPress: onOpenChecks
    }
  ])
  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      onAfterClose={() => {
        const next = afterCloseRef.current
        afterCloseRef.current = null
        next?.()
      }}
      dragContentToDismiss
    >
      {chatItems.length > 0 ? (
        <View>
          <SheetSectionLabel label="Chat" count={chatItems.length} />
          <MenuGroup items={chatItems} onPick={pick} />
        </View>
      ) : null}
      {environmentItems.length > 0 ? (
        <View>
          <SheetSectionLabel label="Environment" count={environmentItems.length} />
          <MenuGroup items={environmentItems} onPick={pick} />
        </View>
      ) : null}
    </BottomDrawer>
  )
}

function shown(items: MenuItem[]): MenuItem[] {
  return items.filter((item) => item.show)
}

function MenuGroup({ items, onPick }: { items: MenuItem[]; onPick: (item: MenuItem) => void }) {
  return (
    <View style={styles.group}>
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <View key={item.key}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={item.disabled === true}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onPick(item)}
            >
              <Icon size={16} color={colors.textSecondary} strokeWidth={2.1} />
              <Text style={styles.label}>{item.label}</Text>
              {item.hint ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {item.hint}
                </Text>
              ) : null}
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.md
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  label: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  hint: {
    maxWidth: '55%',
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
