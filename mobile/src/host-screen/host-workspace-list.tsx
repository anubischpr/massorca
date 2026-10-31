import { useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react-native'
import { AuthFailedBanner } from '../components/AuthFailedBanner'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { HostDiagnosticsLink } from '../components/HostDiagnosticsLink'
import { HostRouteNoticeBanner } from '../components/HostRouteNoticeBanner'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { MobileSearchField } from '../components/MobileSearchField'
import { NewWorkspaceFab, FAB_SIZE } from '../components/NewWorkspaceFab'
import { TextInputModal } from '../components/TextInputModal'
import { SessionStatusMark } from '../components/SessionStatusMark'
import { WorktreeListRow } from '../components/WorktreeListRow'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { useClipboardWriter } from '../platform/clipboard'
import { colors, spacing } from '../theme/mobile-theme'
import { agentDisplayLabel } from '../worktree/agent-row-display'
import {
  buildSessionSheetActions,
  canManageSessionTerminal
} from '../worktree/session-sheet-actions'
import {
  displayBranchName,
  getBranchCollisionChips,
  resolveBranchRowLabel
} from '../worktree/branch-row-label'
import { getWorktreeRowIdentity } from '../worktree/worktree-host-row-identity'
import { HostWorkspaceListStates } from '../worktree/host-workspace-list-states'
import { foldedSectionGlyph } from '../worktree/session-status-glyph'
import { getWorktreeStatus } from '../worktree/workspace-list-sections'
import type { Worktree } from '../worktree/workspace-list-types'
import { repoGroupAccountLabel } from './host-repo-group-account'
import { hostScreenStyles as styles } from './host-screen-styles'
import { closeSessionTerminal, renameSessionTerminal } from './host-session-terminal-actions'
import { FolderRepoNoGitPill, FolderRepoNoGitSheet } from './folder-repo-no-git'
import { useFolderRepoGitInit } from './use-folder-repo-git-init'
import type { HostScreenController } from './use-host-screen-controller'
import { isHostRowUnreachable } from './worktree-row-policy'

// Why: a confirmation like "Path copied" is read at a glance, then gets out of the way.
const COPY_NOTICE_MS = 2000

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
  const { rawSections, sections, uniqueRepoColors, agentOwners, branchLabels } = sectionsResult
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
    /** The session runs in another worktree than the one its row is listed under. */
    runsElsewhere: boolean
  } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ handle: string } | null>(null)
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
  const copyNotice = state.copyNotice
  const setCopyNotice = state.setCopyNotice
  useEffect(() => {
    if (!copyNotice) {
      return
    }
    const timer = setTimeout(() => setCopyNotice(''), COPY_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [copyNotice, setCopyNotice])
  const copyPath = (path: string) => {
    void clipboard
      .writeText(path)
      .then(() => setCopyNotice('Path copied'))
      .catch(() => state.setActionError('Could not copy the path to the clipboard.'))
  }
  // Why: the handle is offered only while the row may manage its terminal; a row without one gets Copy Path alone.
  const sessionHandle =
    sessionTarget &&
    canManageSessionTerminal(sessionTarget.agent, { runsElsewhere: sessionTarget.runsElsewhere })
      ? (sessionTarget.agent.terminalHandle ?? null)
      : null
  const renameSession = async (handle: string, title: string) => {
    if (!client) {
      return
    }
    try {
      if (await renameSessionTerminal(client, handle, title)) {
        void catalog.fetchWorktrees()
      } else {
        state.setActionError('Could not rename the session.')
      }
    } catch {
      state.setActionError('Could not rename the session.')
    }
  }
  const closeSession = async (handle: string) => {
    if (!client) {
      return
    }
    try {
      if (await closeSessionTerminal(client, handle)) {
        void catalog.fetchWorktrees()
      } else {
        state.setActionError('Could not close the session.')
      }
    } catch {
      state.setActionError('Could not close the session.')
    }
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

      {/* An action that did happen, confirmed above the list and dismissed on its own. */}
      {copyNotice ? (
        <HostRouteNoticeBanner message={copyNotice} onDismiss={() => setCopyNotice('')} />
      ) : null}

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
            // Why: a folded group hides its rows, so its header speaks for the worst of them, placed children included.
            const foldedGlyph = isCollapsed
              ? foldedSectionGlyph(rawSection?.data ?? [], now, isHostRowUnreachable(connState))
              : null
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
                {foldedGlyph ? <SessionStatusMark glyph={foldedGlyph} /> : null}
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
              hostDisconnected={isHostRowUnreachable(connState)}
              branchLabel={branchLabels.get(getWorktreeRowIdentity(item)) ?? null}
              agentOwners={agentOwners}
              onPress={actions.openWorktreeSession}
              onLongPress={state.setActionTarget}
              onLongPressSession={(row, agent) => {
                const owner = agentOwners.get(agent.paneKey)
                setSessionTarget({
                  item: owner?.item ?? row,
                  agent,
                  runsElsewhere: owner !== undefined
                })
              }}
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

      {/* Long-press sheet for one session row: its title, the worktree it runs in, and what it may do. */}
      <ActionSheetModal
        visible={sessionTarget !== null}
        title={sessionTarget ? agentDisplayLabel(sessionTarget.agent, now) : undefined}
        message={
          sessionTarget
            ? resolveBranchRowLabel(sessionTarget.item, {
                branchLabel: branchLabels.get(getWorktreeRowIdentity(sessionTarget.item))
              }).label
            : undefined
        }
        actions={
          sessionTarget
            ? buildSessionSheetActions({
                onCopyPath: () => copyPath(sessionTarget.item.path),
                onRename: sessionHandle
                  ? () => setRenameTarget({ handle: sessionHandle })
                  : undefined,
                onClose: sessionHandle ? () => void closeSession(sessionHandle) : undefined,
                onOpenWorktree: sessionTarget.runsElsewhere
                  ? () => state.setActionTarget(sessionTarget.item)
                  : undefined
              })
            : []
        }
        onClose={() => setSessionTarget(null)}
      />

      {/* Why: mounted only while a rename is pending, so an idle list paints no hidden modal. */}
      {renameTarget !== null ? (
        <TextInputModal
          visible
          title="Rename Terminal"
          placeholder="Terminal name"
          onSubmit={(value) => {
            setRenameTarget(null)
            void renameSession(renameTarget.handle, value.trim())
          }}
          onCancel={() => setRenameTarget(null)}
        />
      ) : null}

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
