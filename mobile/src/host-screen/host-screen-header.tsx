import { Pressable, Text, View } from 'react-native'
import {
  ChevronLeft,
  Filter,
  Layers,
  List,
  PanelLeftClose,
  Plus,
  Search,
  SlidersHorizontal,
  SquareTerminal,
  UserCircle,
  X
} from 'lucide-react-native'
import { MobileBotTeamModeSwitch } from '../bot-teams/MobileBotTeamModeSwitch'
import { colors } from '../theme/mobile-theme'
import { HostIdentity, HostReconnectButton } from './host-screen-identity'
import { HostScreenPhoneTopBar } from './host-screen-phone-top-bar'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

/** The phone's Workspaces bar, or the embedded sidebar's header with its two toolbar rows. */
export function HostScreenHeader({ controller }: { controller: HostScreenController }) {
  if (!controller.embedded) {
    return <HostScreenPhoneTopBar controller={controller} />
  }
  const {
    actions,
    connState,
    floatingWorkspaceEnabled,
    hostId,
    onHideSidebar,
    onShowTeams,
    settings,
    state
  } = controller

  return (
    <View style={styles.topChrome}>
      <View style={styles.statusBar}>
        <Pressable
          style={styles.backButton}
          onPress={actions.leaveHost}
          accessibilityRole="button"
          accessibilityLabel="Back to hosts"
          hitSlop={8}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <HostIdentity controller={controller} />
        <HostReconnectButton controller={controller} />
        {onShowTeams ? <MobileBotTeamModeSwitch mode="workspaces" onChange={onShowTeams} /> : null}
        {onHideSidebar ? (
          <Pressable
            style={styles.sidebarCollapseButton}
            onPress={onHideSidebar}
            accessibilityRole="button"
            accessibilityLabel="Hide sidebar"
            hitSlop={8}
          >
            <PanelLeftClose size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter/sort/group toolbar */}
      <View style={styles.embeddedToolbar}>
        <View style={styles.embeddedToolbarRow}>
          <Pressable
            style={[
              styles.filterChip,
              styles.embeddedFilterChip,
              settings.activeFilterCount > 0 && styles.filterChipActive
            ]}
            onPress={() => state.setShowFilterModal(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filter workspaces${settings.activeFilterCount > 0 ? `, ${settings.activeFilterCount} active` : ''}`}
          >
            <Filter
              size={12}
              color={settings.activeFilterCount > 0 ? colors.textPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                settings.activeFilterCount > 0 && styles.filterChipTextActive
              ]}
              numberOfLines={1}
            >
              Filter
              {settings.activeFilterCount > 0 ? ` ${settings.activeFilterCount}` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modeButton, styles.embeddedModeButton]}
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
            style={[styles.modeButton, styles.embeddedModeButton]}
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

        <View style={styles.embeddedToolbarRow}>
          <Pressable
            style={[
              styles.embeddedToolbarIconButton,
              connState !== 'connected' && styles.toolbarIconDisabled
            ]}
            onPress={() =>
              actions.navigateFromHostList(`/h/${encodeURIComponent(hostId)}/accounts`)
            }
            disabled={connState !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel="Accounts"
          >
            <UserCircle
              size={16}
              color={connState === 'connected' ? colors.textSecondary : colors.textMuted}
            />
          </Pressable>

          <Pressable
            style={[
              styles.embeddedToolbarIconButton,
              connState !== 'connected' && styles.toolbarIconDisabled
            ]}
            onPress={() => actions.navigateFromHostList(`/h/${encodeURIComponent(hostId)}/tasks`)}
            disabled={connState !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel="Tasks"
          >
            <List
              size={16}
              color={connState === 'connected' ? colors.textSecondary : colors.textMuted}
            />
          </Pressable>

          {floatingWorkspaceEnabled ? (
            <Pressable
              style={[
                styles.embeddedToolbarIconButton,
                connState !== 'connected' && styles.toolbarIconDisabled
              ]}
              onPress={actions.openFloatingWorkspace}
              disabled={connState !== 'connected'}
              accessibilityRole="button"
              accessibilityLabel="Floating Workspace"
            >
              <SquareTerminal
                size={18}
                color={connState === 'connected' ? colors.textSecondary : colors.textMuted}
              />
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.embeddedToolbarIconButton,
              connState !== 'connected' && styles.toolbarIconDisabled
            ]}
            onPress={actions.openNewSession}
            disabled={connState !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel="New session"
          >
            <Plus
              size={16}
              color={connState === 'connected' ? colors.textPrimary : colors.textMuted}
            />
          </Pressable>

          <Pressable
            style={styles.embeddedToolbarIconButton}
            onPress={() => state.setShowSearch((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={state.showSearch ? 'Close search' : 'Search workspaces'}
          >
            {state.showSearch ? (
              <X size={16} color={colors.textSecondary} />
            ) : (
              <Search size={16} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}
