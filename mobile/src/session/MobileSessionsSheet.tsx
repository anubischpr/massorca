import { useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, File, FileText, Globe, Plus, SquareTerminal } from 'lucide-react-native'
import { MobileAgentSessionHistoryIcon } from '../agent-history/MobileAgentSessionHistoryIcon'
import { AgentStateDot } from '../components/AgentStateDot'
import { BottomDrawer } from '../components/BottomDrawer'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { MobileSessionTab } from './mobile-session-route-types'
import {
  mobileSessionSwitcherDot,
  mobileSessionSwitcherLabel,
  type MobileSessionSwitcherRow
} from './mobile-session-switcher-rows'
import { groupSessionRowsByParent } from './mobile-session-tab-lineage'
import { resolveMobileChatTabPiRuntime } from './mobile-structured-pi-runtime-record'
import {
  getMobileSessionTabTitle,
  resolveMobileTerminalTabAgentId,
  resolveMobileTerminalTabPiRuntime
} from './mobile-terminal-tab-agent'

const NO_PARENT_TABS: ReadonlyMap<string, string> = new Map()

type Props = {
  visible: boolean
  rows: readonly MobileSessionSwitcherRow<MobileSessionTab>[]
  /** Hidden where the host has no agent history to resume (folder and floating workspaces too). */
  showResume: boolean
  onClose: () => void
  onSelect: (tab: MobileSessionTab) => void
  onNewTab: () => void
  onResume: () => void
  /** Close and rename for one tab, reached by holding its row. */
  onTabActions: (tab: MobileSessionTab) => void
  /** A create is pending or the host is not connected: a new tab waits, as the header's + did. */
  newTabDisabled?: boolean
  /** Child tab id to its parent tab id: a child draws one level under its parent. None means a flat list. */
  childParentTabIds?: ReadonlyMap<string, string>
}

/** The worktree's tabs as one list: pick one to switch to it, or start or resume a session. */
export function MobileSessionsSheet({
  visible,
  rows,
  showResume,
  onClose,
  onSelect,
  onNewTab,
  onResume,
  onTabActions,
  newTabDisabled = false,
  childParentTabIds = NO_PARENT_TABS
}: Props) {
  // Why: iOS cannot present a second native modal until this sheet has unmounted, so the
  // follow-up action waits for onAfterClose.
  const afterCloseRef = useRef<(() => void) | null>(null)
  const closeThen = (next: () => void) => {
    afterCloseRef.current = next
    onClose()
  }
  const sessionRow = (row: MobileSessionSwitcherRow<MobileSessionTab>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getMobileSessionTabTitle(row.tab)}
      accessibilityState={{ selected: row.isActive }}
      accessibilityHint="Hold for close and rename"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => {
        onSelect(row.tab)
        onClose()
      }}
      onLongPress={() => closeThen(() => onTabActions(row.tab))}
      delayLongPress={400}
    >
      <TabKindIcon tab={row.tab} />
      <View style={styles.textBlock}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {getMobileSessionTabTitle(row.tab)}
        </Text>
        <View style={styles.statusRow}>
          {row.status ? <AgentStateDot state={mobileSessionSwitcherDot(row.status)} /> : null}
          <Text style={styles.meta}>
            {row.status ? mobileSessionSwitcherLabel(row.status) : kindLabel(row.tab.type)}
          </Text>
        </View>
      </View>
      {row.isActive ? <Check size={16} color={colors.textPrimary} strokeWidth={2.2} /> : null}
    </Pressable>
  )
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
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New tab"
          disabled={newTabDisabled}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => closeThen(onNewTab)}
        >
          <Plus size={16} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>
      <SheetSectionLabel label="Tabs" count={rows.length} />
      <View style={styles.group}>
        {groupSessionRowsByParent(rows, childParentTabIds).map((group, index) => (
          <View key={group.row.tab.id}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {sessionRow(group.row)}
            {group.children.length > 0 ? (
              <View style={styles.childGroup} testID="session-child-rows">
                {group.children.map((child) => (
                  <View key={child.tab.id}>{sessionRow(child)}</View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {showResume ? (
        <View style={styles.group}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => closeThen(onResume)}
          >
            <MobileAgentSessionHistoryIcon
              size={16}
              color={colors.textSecondary}
              strokeWidth={2.1}
            />
            <View style={styles.textBlock}>
              <Text style={styles.rowTitle}>Resume an earlier session</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </BottomDrawer>
  )
}

function TabKindIcon({ tab }: { tab: MobileSessionTab }) {
  const iconColor = colors.textSecondary
  switch (tab.type) {
    case 'agent-session':
      return (
        <MobileAgentIcon
          agentId={tab.agent}
          size={16}
          piRuntime={resolveMobileChatTabPiRuntime(tab)}
        />
      )
    case 'terminal': {
      const agentId = resolveMobileTerminalTabAgentId(tab)
      return agentId ? (
        <MobileAgentIcon
          agentId={agentId}
          size={16}
          piRuntime={resolveMobileTerminalTabPiRuntime(tab)}
        />
      ) : (
        <SquareTerminal size={16} color={iconColor} strokeWidth={2.1} />
      )
    }
    case 'markdown':
      return <FileText size={16} color={iconColor} strokeWidth={2.1} />
    case 'file':
      return <File size={16} color={iconColor} strokeWidth={2.1} />
    case 'browser':
      return <Globe size={16} color={iconColor} strokeWidth={2.1} />
  }
}

function kindLabel(type: MobileSessionTab['type']): string {
  switch (type) {
    case 'agent-session':
      return 'Chat'
    case 'terminal':
      return 'Terminal'
    case 'markdown':
      return 'Markdown'
    case 'file':
      return 'File'
    case 'browser':
      return 'Browser'
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600'
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button
  },
  group: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  childGroup: {
    marginLeft: spacing.xl + spacing.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderSubtle
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.md
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  }
})
