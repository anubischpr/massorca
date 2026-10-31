import { openExternalLink } from '../platform/external-link'
import { Pressable, Text, View } from 'react-native'
import { Check, Copy, Moon, Pin, PinOff, Trash2 } from 'lucide-react-native'
import { buildWorktreeNavigationActions } from '../agent-history/worktree-navigation-actions'
import { ActionSheetContent, type ActionSheetAction } from '../components/ActionSheetModal'
import { BottomDrawer } from '../components/BottomDrawer'
import { ConfirmModal } from '../components/ConfirmModal'
import { NewWorktreeModalController } from '../components/NewWorktreeModalController'
import { PickerModal } from '../components/PickerModal'
import { useClipboardWriter } from '../platform/clipboard'
import { colors } from '../theme/mobile-theme'
import { hostNewWorktreeSessionRoute } from '../host-route-action-state'
import { displayBranchName, resolveBranchRowLabel } from '../worktree/branch-row-label'
import { getWorktreeRowIdentity } from '../worktree/worktree-host-row-identity'
import {
  WORKSPACE_GROUP_OPTIONS as GROUP_OPTIONS,
  WORKSPACE_SORT_OPTIONS as SORT_OPTIONS,
  WORKSPACE_VIEW_SHARED_NOTE
} from '../worktree/workspace-list-picker-options'
import { isWorktreePinned } from '../worktree/workspace-list-sections'
import type { Worktree } from '../worktree/workspace-list-types'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'
import { canDeleteFromWorktreeSheet } from './worktree-row-policy'

export function HostScreenOverlays({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    catalog,
    client,
    existingWorktreePaths,
    hostCapabilities,
    hostId,
    settings,
    showNewWorktree,
    state
  } = controller
  const actionTarget = state.actionTarget
  const clipboard = useClipboardWriter()
  const copyPath = (path: string) => {
    void clipboard
      .writeText(path)
      .catch(() => state.setActionError('Could not copy the path to the clipboard.'))
  }

  // Why: a folder workspace has no branch to sleep, pin or delete differently, but it has no git
  // source control, so its sheet leaves that action out.
  const branchSheetActions = (target: Worktree): ActionSheetAction[] => {
    const isFolder = target.workspaceKind === 'folder-workspace'
    const label = resolveBranchRowLabel(target).label
    const pinned = isWorktreePinned(target, state.pinnedIds)
    return [
      {
        label: 'Copy Path',
        icon: Copy,
        onPress: () => {
          copyPath(target.path)
          state.setActionTarget(null)
        }
      },
      ...buildWorktreeNavigationActions({
        hostId,
        worktreeId: target.worktreeId,
        worktreeName: label,
        hostCapabilities,
        navigate: actions.navigateFromHostList,
        onDone: () => state.setActionTarget(null),
        includeSourceControl: !isFolder
      }),
      {
        label: 'Sleep',
        icon: Moon,
        onPress: () => {
          if (client) {
            state.setSleptIds((prev) => new Set(prev).add(getWorktreeRowIdentity(target)))
            void client
              .sendRequest('worktree.sleep', {
                worktree: `id:${target.worktreeId}`
              })
              .catch(() => null)
          }
          state.setActionTarget(null)
        }
      },
      {
        label: pinned ? 'Unpin' : 'Pin',
        icon: pinned ? PinOff : Pin,
        onPress: () => {
          actions.togglePin(target.worktreeId)
          state.setActionTarget(null)
        }
      },
      ...(canDeleteFromWorktreeSheet(target)
        ? [
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onPress: () => state.setConfirmDelete(target)
            }
          ]
        : [])
    ]
  }

  return (
    <>
      <PickerModal
        visible={state.showSortPicker}
        title="Sort By"
        subtitle={WORKSPACE_VIEW_SHARED_NOTE}
        options={SORT_OPTIONS}
        selected={state.sortMode}
        onSelect={settings.handleSortChange}
        onClose={() => state.setShowSortPicker(false)}
      />

      <PickerModal
        visible={state.showGroupPicker}
        title="Group By"
        subtitle={WORKSPACE_VIEW_SHARED_NOTE}
        options={GROUP_OPTIONS}
        selected={state.groupMode}
        onSelect={settings.handleGroupChange}
        onClose={() => state.setShowGroupPicker(false)}
      />

      <BottomDrawer visible={state.showFilterModal} onClose={() => state.setShowFilterModal(false)}>
        <View style={styles.filterModalHeader}>
          <View style={styles.filterModalHeading}>
            <Text style={styles.filterModalTitle}>Filter</Text>
            <Text style={styles.filterModalSubtitle}>{WORKSPACE_VIEW_SHARED_NOTE}</Text>
          </View>
          {settings.activeFilterCount > 0 && (
            <Pressable onPress={settings.clearFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.filterSectionLabel}>Workspaces</Text>
        <View style={styles.filterGroup}>
          <Pressable style={styles.filterRow} onPress={settings.toggleHideSleeping}>
            <Text style={styles.filterRowText}>Hide sleeping</Text>
            {state.filters.hideSleeping && <Check size={14} color={colors.textPrimary} />}
          </Pressable>
          <View style={styles.filterSeparator} />
          <Pressable style={styles.filterRow} onPress={settings.toggleHideDefaultBranch}>
            <Text style={styles.filterRowText}>Hide default branch</Text>
            {state.filters.hideDefaultBranch && <Check size={14} color={colors.textPrimary} />}
          </Pressable>
        </View>

        {controller.sectionsResult.uniqueRepos.length > 1 && (
          <>
            <Text style={styles.filterSectionLabel}>Repositories</Text>
            <View style={styles.filterGroup}>
              {controller.sectionsResult.uniqueRepos.map((repo, i) => (
                <View key={repo.id}>
                  {i > 0 && <View style={styles.filterSeparator} />}
                  <Pressable
                    style={styles.filterRow}
                    onPress={() => settings.toggleRepoFilter(repo.id)}
                  >
                    <View style={[styles.filterRepoDot, { backgroundColor: repo.color }]} />
                    <Text style={styles.filterRowText} numberOfLines={1}>
                      {repo.name}
                    </Text>
                    {state.filters.filterRepoIds.has(repo.id) && (
                      <Check size={14} color={colors.textPrimary} />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </BottomDrawer>

      {/* Worktree long-press action sheet (inline confirm to avoid double-Modal lag) */}
      <BottomDrawer
        visible={actionTarget != null}
        onClose={() => {
          state.setConfirmDelete(null)
          state.setActionTarget(null)
        }}
      >
        {state.confirmDelete ? (
          <View>
            <View style={styles.confirmContent}>
              <Text style={styles.confirmTitle}>Delete Worktree</Text>
              <Text style={styles.confirmMessage}>
                {`Delete "${resolveBranchRowLabel(state.confirmDelete).label}"${
                  state.confirmDelete.branch
                    ? ` (${displayBranchName(state.confirmDelete.branch)})`
                    : ''
                }?`}
              </Text>
            </View>
            <View style={styles.confirmButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  styles.confirmBtnCancel,
                  pressed && styles.confirmBtnPressed
                ]}
                onPress={() => state.setConfirmDelete(null)}
              >
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  styles.confirmBtnDestructive,
                  pressed && styles.confirmBtnPressed
                ]}
                onPress={() => {
                  if (state.confirmDelete) {
                    void actions.handleDeleteWorktree(state.confirmDelete)
                  }
                  state.setConfirmDelete(null)
                  state.setActionTarget(null)
                }}
              >
                <Text style={styles.confirmBtnDestructiveText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ActionSheetContent
            title={actionTarget ? resolveBranchRowLabel(actionTarget).label : undefined}
            message={
              actionTarget
                ? [
                    actionTarget.workspaceKind === 'folder-workspace'
                      ? ''
                      : displayBranchName(actionTarget.branch),
                    actionTarget.path
                  ]
                    .filter((part) => part.length > 0)
                    .join(' · ')
                : undefined
            }
            actions={actionTarget ? branchSheetActions(actionTarget) : []}
          />
        )}
      </BottomDrawer>

      {/* Host remove confirmation */}
      <ConfirmModal
        visible={state.confirmRemoveHost}
        title="Remove Host"
        message={`Remove "${state.hostName}"? You can re-pair later.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => void actions.handleRemoveHost()}
        onCancel={() => state.setConfirmRemoveHost(false)}
      />

      <NewWorktreeModalController
        ref={state.newWorktreeModalRef}
        routeVisible={showNewWorktree}
        client={client}
        hostId={hostId}
        existingWorktreePaths={existingWorktreePaths}
        existingWorktrees={state.worktrees}
        // The seam, not react-native's `Linking`: this screen is in the tasks page closure, and
        // inside the shell's WebView `openURL` resolves without opening anything.
        openExternalUrl={openExternalLink}
        onVisibleChange={(visible) => {
          state.newWorktreeModalVisibleRef.current = visible
        }}
        onCreated={(worktreeId, worktreeName, warning) => {
          void catalog.fetchWorktrees({ allowDuringModal: true })
          actions.navigateFromHostList(
            hostNewWorktreeSessionRoute(hostId, worktreeId, worktreeName, warning)
          )
        }}
        onRouteVisibleChange={actions.setShowNewWorktreeVisible}
      />
    </>
  )
}
