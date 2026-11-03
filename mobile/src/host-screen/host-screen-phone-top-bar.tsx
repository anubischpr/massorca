import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  ChevronLeft,
  Filter,
  Layers,
  List,
  Search,
  SlidersHorizontal,
  SquareTerminal,
  UserCircle,
  X
} from 'lucide-react-native'
import { MobileBotTeamModeSwitch } from '../bot-teams/MobileBotTeamModeSwitch'
import { botTeamStyles } from '../bot-teams/mobile-bot-team-styles'
import { colors, spacing } from '../theme/mobile-theme'
import { HostIdentity, HostReconnectButton } from './host-screen-identity'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

const phoneStyles = StyleSheet.create({
  hostLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  }
})

/**
 * The Workspaces bar on a phone, built as the Bot teams bar is: the space switch on the left and
 * the icon buttons on the right. The host line sits under it, then the filter, sort and group chips.
 */
export function HostScreenPhoneTopBar({ controller }: { controller: HostScreenController }) {
  const { actions, connState, floatingWorkspaceEnabled, hostId, onShowTeams, settings, state } =
    controller
  const offline = connState !== 'connected'
  const filtered = settings.activeFilterCount > 0

  return (
    <View>
      <View style={botTeamStyles.bar}>
        {onShowTeams ? <MobileBotTeamModeSwitch mode="workspaces" onChange={onShowTeams} /> : null}
        <View style={botTeamStyles.grow} />
        {floatingWorkspaceEnabled ? (
          <Pressable
            style={[botTeamStyles.iconButton, offline && styles.toolbarIconDisabled]}
            onPress={actions.openFloatingWorkspace}
            disabled={offline}
            accessibilityRole="button"
            accessibilityLabel="Floating Workspace"
            hitSlop={8}
          >
            <SquareTerminal size={18} color={offline ? colors.textMuted : colors.textPrimary} />
          </Pressable>
        ) : null}
        <Pressable
          style={botTeamStyles.iconButton}
          onPress={() => actions.navigateFromHostList(`/h/${encodeURIComponent(hostId)}/accounts`)}
          disabled={offline}
          accessibilityRole="button"
          accessibilityLabel="Accounts"
        >
          <UserCircle size={22} color={offline ? colors.textMuted : colors.textSecondary} />
        </Pressable>
        <Pressable
          style={botTeamStyles.iconButton}
          onPress={() => actions.navigateFromHostList(`/h/${encodeURIComponent(hostId)}/tasks`)}
          disabled={offline}
          accessibilityRole="button"
          accessibilityLabel="Tasks"
        >
          <List size={22} color={offline ? colors.textMuted : colors.textSecondary} />
        </Pressable>
        <Pressable
          style={botTeamStyles.iconButton}
          onPress={() => state.setShowSearch((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={state.showSearch ? 'Close search' : 'Search workspaces'}
        >
          {state.showSearch ? (
            <X size={22} color={colors.textSecondary} />
          ) : (
            <Search size={22} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>

      <View style={phoneStyles.hostLine}>
        <Pressable
          style={phoneStyles.backButton}
          onPress={actions.leaveHost}
          accessibilityRole="button"
          accessibilityLabel="Back to hosts"
          hitSlop={8}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <HostIdentity controller={controller} />
        <HostReconnectButton controller={controller} />
      </View>

      <View style={phoneStyles.toolbar}>
        <Pressable
          style={[styles.filterChip, filtered && styles.filterChipActive]}
          onPress={() => state.setShowFilterModal(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filter workspaces${filtered ? `, ${settings.activeFilterCount} active` : ''}`}
        >
          <Filter size={12} color={filtered ? colors.textPrimary : colors.textSecondary} />
          <Text style={[styles.filterChipText, filtered && styles.filterChipTextActive]}>
            Filter
            {filtered ? ` (${settings.activeFilterCount})` : ''}
          </Text>
        </Pressable>

        <Pressable
          style={styles.modeButton}
          onPress={() => state.setShowSortPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${settings.selectedSortLabel}`}
        >
          <SlidersHorizontal size={14} color={colors.textSecondary} />
          <Text style={styles.sortLabel} numberOfLines={1}>
            {settings.selectedSortLabel}
          </Text>
        </Pressable>

        <Pressable
          style={styles.modeButton}
          onPress={() => state.setShowGroupPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Group workspaces"
        >
          <Layers size={14} color={colors.textSecondary} />
          <Text style={styles.sortLabel} numberOfLines={1}>
            {state.groupMode === 'none'
              ? 'Group'
              : state.groupMode === 'workspaceStatus'
                ? 'Status'
                : state.groupMode === 'repo'
                  ? 'Repo'
                  : 'PR'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
