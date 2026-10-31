import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react-native'
import { AuthFailedBanner } from '../components/AuthFailedBanner'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { HostDiagnosticsLink } from '../components/HostDiagnosticsLink'
import { HostRouteNoticeBanner } from '../components/HostRouteNoticeBanner'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { MobileSearchField } from '../components/MobileSearchField'
import { NewWorkspaceFab, FAB_SIZE } from '../components/NewWorkspaceFab'
import { WorktreeListRow } from '../components/WorktreeListRow'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { useClipboardWriter } from '../platform/clipboard'
import { colors, spacing } from '../theme/mobile-theme'
import { agentDisplayLabel } from '../worktree/agent-row-display'
import { buildSessionSheetActions } from '../worktree/session-sheet-actions'
import {
  displayBranchName,
  getBranchCollisionChips,
  resolveBranchRowLabel
} from '../worktree/branch-row-label'
import { getWorktreeRowIdentity } from '../worktree/worktree-host-row-identity'
import { HostWorkspaceListStates } from '../worktree/host-workspace-list-states'
import { getWorktreeStatus } from '../worktree/workspace-list-sections'
import type { Worktree } from '../worktree/workspace-list-types'
import { repoGroupAccountLabel } from './host-repo-group-account'
import { hostScreenStyles as styles } from './host-screen-styles'
import { FolderRepoNoGitPill, FolderRepoNoGitSheet } from './folder-repo-no-git'
import { useFolderRepoGitInit } from './use-folder-repo-git-init'
import type { HostScreenController } from './use-host-screen-controller'

export function HostWorkspaceList({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    activeWorktreeScroll,
    catalog,
    client,
    connState,
    contentMaxWidth,
    displayWorktrees,
    embedded,
    fetchRepoMetadata,
    forceReconnectHost,
    hostCapabilities,
    hostId,
    insets,
    isReadOnly,
    isWideLayout,
    noticeParam,
    now,
    reconnectAttempts,
    relayRecovery,
    routeNotice,
    router,
    sectionsResult,
    setDismissedNotice,
    settings,
    state
  } = controller
  const { rawSections, sections, uniqueRepoColors } = sectionsResult
  const noGit = useFolderRepoGitInit({
    client,
    connected: connState === 'connected',
    refreshRepos: () => void fetchRepoMetadata({ force: true }),
    onFailure: state.setActionError
  })
  const clipboard = useClipboardWriter()
  const [sessionTarget, setSessionTarget] = useState<{
    item: Worktree
    agent: RuntimeWorktreeAgentRow
  } | null>(null)
  const groupMode = state.groupMode
  // Why: a same-branch collision names the host (or the project when the hosts match) only here.
  const collisionChips = useMemo(
    () =>
      getBranchCollisionChips(
        sections.flatMap((section) =>
          section.data.map((item) => ({
            key: getWorktreeRowIdentity(item),
            scope: groupMode === 'repo' ? section.key : '',
            branch: item.workspaceKind === 'folder-workspace' ? '' : displayBranchName(item.branch),
            repo: item.repo,
            hostKey: String(item.hostContextHostId ?? item.hostId ?? ''),
            hostLabel: item.hostContextLabel
          }))
        )
      ),
    [sections, groupMode]
  )
  const copyPath = (path: string) => {
    void clipboard
      .writeText(path)
      .catch(() => state.setActionError('Could not copy the path to the clipboard.'))
  }

  return (
    <>
      {/* Auth failed: a latched relay rejection must reach the same re-pair affordance. */}
      {(connState === 'auth-failed' || relayRecovery.pairingRejected) && (
        <AuthFailedBanner
          canRetry={!!hostId && forceReconnectHost !== null}
          onRetry={() => hostId && forceReconnectHost && void forceReconnectHost(hostId)}
          onRepair={() => router.push('/pair-scan')}
          onRemove={() => state.setConfirmRemoveHost(true)}
        />
      )}

      {connState !== 'connected' &&
      !relayRecovery.pairingRejected &&
      reconnectAttempts >= 3 &&
      hostId ? (
        <HostDiagnosticsLink
          onPress={() =>
            router.push({ pathname: '/connection-log', params: { hostId: String(hostId) } })
          }
        />
      ) : null}

      {/* Why a bounced route landed here (e.g. the workspace was deleted on the desktop). */}
      {routeNotice && (
        <HostRouteNoticeBanner
          message={routeNotice}
          onDismiss={() => setDismissedNotice(noticeParam ?? null)}
        />
      )}

      {/* An action that did not happen. Above the list and dismissible, because the list, the
          header and the confirm it re-opens all have to stay on screen. */}
      {state.actionError !== '' && (
        <HostRouteNoticeBanner
          message={state.actionError}
          tone="failure"
          onDismiss={() => state.setActionError('')}
        />
      )}

      {/* Search bar */}
      {state.showSearch && (
        <View style={styles.searchBar}>
          <MobileSearchField
            value={state.search}
            onChangeText={state.setSearch}
            placeholder="Search worktrees…"
            autoFocus
            // Why: new key per open remounts the focus effect across rapid toggles so the keyboard reappears.
            focusKey={state.showSearch}
            accessibilityLabel="Search worktrees"
          />
        </View>
      )}

      <HostWorkspaceListStates
        connState={connState}
        worktreesLoaded={state.worktreesLoaded}
        displayCount={displayWorktrees.length}
        sectionCount={sections.length}
        catalogError={state.catalogError}
        search={state.search}
        activeFilterCount={settings.activeFilterCount}
      />

      {sections.length > 0 && (
        <SectionList
          ref={activeWorktreeScroll.sectionListRef}
          sections={sections}
          keyExtractor={(w) => w.sectionListKey ?? getWorktreeRowIdentity(w)}
          stickySectionHeadersEnabled={false}
          // Why: keep the search IME up while tapping clear / scrolling results.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollToIndexFailed={activeWorktreeScroll.onScrollToIndexFailed}
          // Why: edge-to-edge under the system nav bar; insets.bottom keeps the last row above it.
          contentContainerStyle={[
            styles.list,
            // Reserve room so the last row stays tappable above the phone's floating "+" (embedded uses the toolbar +).
            { paddingBottom: (embedded ? spacing.lg : FAB_SIZE + spacing.xl) + insets.bottom },
            isWideLayout &&
              !embedded && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
          ]}
          renderSectionHeader={({ section }) => {
            if (!section.title) {
              return null
            }
            const isCollapsed = state.collapsedGroups.has(section.key)
            const rawSection = rawSections.find((s) => s.key === section.key)
            const count = rawSection?.data.length ?? 0
            const repoSectionColor =
              state.groupMode === 'repo' ? uniqueRepoColors.get(section.title) : null
            const repoSectionIcon =
              state.groupMode === 'repo' ? state.repoIconsByName.get(section.title) : null
            const folderRepoId =
              state.groupMode === 'repo' ? state.repoIdsByName.get(section.title) : undefined
            const repoAccount = repoGroupAccountLabel(
              state.groupMode,
              section.title,
              state.repoAccountsByName,
              rawSection?.data ?? []
            )
            return (
              <Pressable
                style={styles.sectionHeader}
                onPress={() => settings.toggleCollapsed(section.key)}
              >
                {isCollapsed ? (
                  <ChevronRight size={12} color={colors.textMuted} style={styles.sectionIcon} />
                ) : (
                  <ChevronDown size={12} color={colors.textMuted} style={styles.sectionIcon} />
                )}
                {section.icon === 'pin' && (
                  <Pin size={12} color={colors.textMuted} style={styles.sectionIcon} />
                )}
                {state.groupMode === 'repo' ? (
                  <View style={styles.sectionRepoIcon}>
                    <MobileRepoIcon
                      repoIcon={repoSectionIcon}
                      size={14}
                      color={repoSectionColor ?? colors.textSecondary}
                    />
                  </View>
                ) : null}
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {folderRepoId !== undefined && state.folderRepoIds.has(folderRepoId) ? (
                  <FolderRepoNoGitPill
                    onPress={() => noGit.open({ repoId: folderRepoId, repoName: section.title })}
                  />
                ) : null}
                {repoAccount ? (
                  <Text style={styles.sectionAccount} numberOfLines={1}>
                    {repoAccount}
                  </Text>
                ) : null}
                <Text style={styles.sectionCount}>{count}</Text>
              </Pressable>
            )
          }}
          ItemSeparatorComponent={ListSeparator}
          // Why (#8498): manual pull-to-refresh forces a fresh snapshot after a stale-cache reconnect.
          refreshControl={
            <RefreshControl
              refreshing={catalog.refreshing}
              onRefresh={catalog.onRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.textSecondary]}
            />
          }
          renderItem={({ item }) => (
            <WorktreeListRow
              item={item}
              isReadOnly={isReadOnly}
              now={now}
              status={getWorktreeStatus(item)}
              collisionChip={collisionChips.get(getWorktreeRowIdentity(item)) ?? null}
              hostDisconnected={connState !== 'connected'}
              onPress={actions.openWorktreeSession}
              onLongPress={state.setActionTarget}
              onLongPressSession={(row, agent) => setSessionTarget({ item: row, agent })}
              onToggleLineage={settings.toggleWorktreeLineage}
            />
          )}
        />
      )}

      <FolderRepoNoGitSheet
        visible={noGit.visible}
        repoName={noGit.target?.repoName ?? null}
        hostCapabilities={hostCapabilities}
        connected={connState === 'connected'}
        initializing={noGit.initializing}
        onInitialize={() => void noGit.initialize()}
        onClose={noGit.close}
      />

      {/* Long-press sheet for one session row: its title, and the worktree it runs in. */}
      <ActionSheetModal
        visible={sessionTarget !== null}
        title={sessionTarget ? agentDisplayLabel(sessionTarget.agent, now) : undefined}
        message={sessionTarget ? resolveBranchRowLabel(sessionTarget.item).label : undefined}
        actions={
          sessionTarget
            ? buildSessionSheetActions({
                onCopyPath: () => copyPath(sessionTarget.item.path)
              })
            : []
        }
        onClose={() => setSessionTarget(null)}
      />

      {/* Floating "new workspace" button — phone only; embedded sidebars keep the toolbar +. */}
      {!embedded && (
        <NewWorkspaceFab onPress={actions.openNewSession} disabled={connState !== 'connected'} />
      )}
    </>
  )
}

function ListSeparator() {
  return <View style={styles.separator} />
}
