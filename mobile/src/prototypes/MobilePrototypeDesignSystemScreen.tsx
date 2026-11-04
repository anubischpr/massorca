import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { activePrototypeSets } from '../../../src/shared/prototype-archived-sets'
import { designSystemChatOf, setsBuiltOn } from '../../../src/shared/prototype-design-system-view'
import {
  DESIGN_SYSTEM_TABS,
  emptyDesignSystemViewState,
  type DesignSystemTab,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import { KeyedBottomDrawer } from '../components/keyed-bottom-drawer'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing } from '../theme/mobile-theme'
import { MobilePrototypeDesignSystemAddSheet } from './MobilePrototypeDesignSystemAddSheet'
import { MobilePrototypeDesignSystemBar } from './MobilePrototypeDesignSystemBar'
import { MobilePrototypeDesignSystemComponentSheet } from './MobilePrototypeDesignSystemComponentSheet'
import { MobilePrototypeDesignSystemDraftSheet } from './MobilePrototypeDesignSystemDraftSheet'
import {
  MobilePrototypeDesignSystemComponents,
  MobilePrototypeDesignSystemSource,
  MobilePrototypeDesignSystemTokens
} from './MobilePrototypeDesignSystemTabs'
import { MobilePrototypeDesignSystemTokenSheet } from './MobilePrototypeDesignSystemTokenSheet'
import { MobilePrototypeDesignSystemVersionBanner } from './MobilePrototypeDesignSystemVersionBanner'
import { MobilePrototypeDesignSystemVersionsSheet } from './MobilePrototypeDesignSystemVersionsSheet'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { mobileDesignSystemSubtitle } from './mobile-prototype-design-system-model'
import {
  designSystemVersionRowsOf,
  latestDesignSystemVersionOf
} from './mobile-prototype-design-system-versions-model'
import { useMobileDesignSystemImages } from './mobile-prototype-design-system-images-hook'
import {
  mobileDesignSystemDraftCount,
  mobileDesignSystemDraftText,
  sendMobileDesignSystemText
} from './mobile-prototype-design-system-send'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { findMobilePrototypeDesignSystem } from './mobile-prototype-sets-state'
import {
  mobilePrototypeDesignSystemKey,
  useMobilePrototypeViewStore
} from './mobile-prototype-view-store'
import { useMobilePrototypeDesignSystemContent } from './use-mobile-prototype-design-system-content'
import { useMobilePrototypeDesignSystemVersions } from './use-mobile-prototype-design-system-versions'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

type Sheet = 'token' | 'component' | 'add' | 'draft' | 'versions'

// One shared empty state, so a project with no state yet hands the same object to every render.
const NO_VIEW_STATE = emptyDesignSystemViewState()

const TAB_LABELS: Readonly<Record<DesignSystemTab, string>> = {
  tokens: 'Tokens',
  components: 'Components',
  source: 'Source'
}

/** One project's design system: Tokens, Components and Source, and the sheets that edit them into the draft. */
export function MobilePrototypeDesignSystemScreen({
  hostId,
  projectKey,
  onBack
}: {
  hostId: string
  projectKey: string
  onBack: () => void
}) {
  const { client } = useHostClient(hostId)
  const listed = useMobilePrototypeSets(hostId)
  const system = findMobilePrototypeDesignSystem(listed, projectKey)
  const activeSets = activePrototypeSets(listed.sets)
  const target = system === null ? undefined : designSystemChatOf(activeSets, system)
  // Why: an earlier version is opened over the current files; null is the live system.
  const [versionView, setVersionView] = useState<number | null>(null)
  const versions = useMobilePrototypeDesignSystemVersions(client, target?.sessionId)
  const versionRows = versions.status === 'ready' ? versions.versions : []
  const latestVersion = latestDesignSystemVersionOf(versionRows)
  const content = useMobilePrototypeDesignSystemContent(
    client,
    target?.sessionId,
    system === null ? '' : `${projectKey}:${system.version}:${system.tokenCount}:${system.status}`,
    versionView
  )
  // Why: an earlier version is read-only: no edits and no sends from it.
  const readOnly = versionView !== null
  const viewKey = mobilePrototypeDesignSystemKey(hostId, projectKey)
  const state =
    useMobilePrototypeViewStore((store) => store.designSystemViews[viewKey]) ?? NO_VIEW_STATE
  const updateView = useMobilePrototypeViewStore((store) => store.updateDesignSystemView)
  const update = useCallback(
    (transform: (latest: DesignSystemViewState) => DesignSystemViewState): void =>
      updateView(viewKey, transform),
    [updateView, viewKey]
  )
  const images = useMobileDesignSystemImages({ client, target, update })
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const readyContent = content.status === 'ready' ? content.content : null
  const selection = state.selection
  const token =
    selection?.kind === 'token'
      ? readyContent?.tokens.find((candidate) => candidate.id === selection.id)
      : undefined
  const section =
    selection?.kind === 'component'
      ? readyContent?.components.find((candidate) => candidate.name === selection.name)
      : undefined
  const rebuildSets = system === null ? [] : setsBuiltOn(activeSets, projectKey, system.version)
  const panel =
    system === null || readyContent === null
      ? null
      : { system, content: readyContent, state, update, target, rebuildSets, images }
  const draftCount = panel === null ? 0 : mobileDesignSystemDraftCount(panel)
  const agentName =
    target === undefined ? (system?.agent ?? '') : mobilePrototypeAgentLabel(target.agent)
  const sendDraft = async (): Promise<void> => {
    if (panel === null) {
      return
    }
    const accepted = await sendMobileDesignSystemText(
      {
        client,
        target,
        getState: () => useMobilePrototypeViewStore.getState().designSystemViews[viewKey],
        update
      },
      'draft',
      mobileDesignSystemDraftText(panel)
    )
    if (accepted) {
      setSheet(null)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader
        title="Design system"
        {...(system === null
          ? {}
          : {
              subtitle: mobileDesignSystemSubtitle(system.projectName, system.version, system.agent)
            })}
        onBack={onBack}
        trailing={
          versions.status === 'ready' && !readOnly ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Versions"
              onPress={() => setSheet('versions')}
              style={styles.versionsButton}
            >
              <Text style={styles.versionsText}>↺ Versions</Text>
            </Pressable>
          ) : null
        }
      />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {DESIGN_SYSTEM_TABS.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: state.tab === tab }}
            onPress={() => {
              setSheet(null)
              update((latest) => ({ ...latest, tab }))
            }}
            style={[styles.tab, state.tab === tab && styles.tabOn]}
          >
            <Text style={[styles.tabText, state.tab === tab && styles.tabTextOn]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        ))}
      </View>
      {versionView === null ||
      client === null ||
      target === undefined ||
      latestVersion === null ? null : (
        <MobilePrototypeDesignSystemVersionBanner
          client={client}
          sessionId={target.sessionId}
          version={versionView}
          latestVersion={latestVersion}
          onBackToCurrent={() => setVersionView(null)}
          onRestored={() => {
            setVersionView(null)
            setSheet(null)
            listed.reload()
            versions.reload()
          }}
        />
      )}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {system !== null && content.status === 'error' ? (
          <Text style={styles.message}>Couldn't open this design system</Text>
        ) : null}
        {panel === null ? null : state.tab === 'tokens' ? (
          <MobilePrototypeDesignSystemTokens
            content={panel.content}
            state={state}
            tokenSheetOpen={sheet === 'token'}
            onPickToken={(id) => {
              if (readOnly) {
                return
              }
              update((latest) => ({ ...latest, selection: { kind: 'token', id } }))
              setSheet('token')
            }}
          />
        ) : state.tab === 'components' ? (
          <MobilePrototypeDesignSystemComponents
            content={panel.content}
            state={state}
            onAdd={() => {
              if (!readOnly) {
                setSheet('add')
              }
            }}
            onPickComponent={(name) => {
              if (readOnly) {
                return
              }
              update((latest) => ({ ...latest, selection: { kind: 'component', name } }))
              setSheet('component')
            }}
          />
        ) : (
          <MobilePrototypeDesignSystemSource content={panel.content} />
        )}
      </ScrollView>
      {readOnly || (draftCount === 0 && state.images.length === 0) ? null : (
        <MobilePrototypeDesignSystemBar
          count={draftCount + state.images.length}
          agentName={agentName}
          onPress={() => setSheet('draft')}
        />
      )}
      <KeyedBottomDrawer<Sheet>
        sheet={panel === null ? null : sheet}
        sheetKey={(presented) => presented}
        contentScrollable={false}
        dragContentToDismiss={false}
        onClose={() => setSheet(null)}
      >
        {(presented) => {
          if (panel === null) {
            return null
          }
          if (presented === 'versions') {
            return (
              <MobilePrototypeDesignSystemVersionsSheet
                rows={designSystemVersionRowsOf(versionRows)}
                onView={(version) => {
                  setVersionView(version)
                  setSheet(null)
                }}
              />
            )
          }
          if (presented === 'draft') {
            return (
              <MobilePrototypeDesignSystemDraftSheet
                system={panel.system}
                content={panel.content}
                state={state}
                update={update}
                target={target}
                rebuildSets={rebuildSets}
                images={panel.images}
                agentName={agentName}
                onClose={() => setSheet(null)}
                onSend={() => void sendDraft()}
              />
            )
          }
          if (presented === 'add') {
            return (
              <MobilePrototypeDesignSystemAddSheet
                state={state}
                update={update}
                onClose={() => setSheet(null)}
                onAdded={() => setSheet(null)}
              />
            )
          }
          if (presented === 'token') {
            return token === undefined ? null : (
              <MobilePrototypeDesignSystemTokenSheet
                token={token}
                content={panel.content}
                state={state}
                update={update}
                rebuildSets={rebuildSets}
                onClose={() => setSheet(null)}
              />
            )
          }
          return section === undefined ? null : (
            <MobilePrototypeDesignSystemComponentSheet
              key={section.name}
              section={section}
              content={panel.content}
              state={state}
              update={update}
              images={panel.images}
              onClose={() => setSheet(null)}
            />
          )
        }}
      </KeyedBottomDrawer>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: 10,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  tab: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabOn: { backgroundColor: colors.bgRaised },
  tabText: { color: colors.textSecondary, fontSize: 14 },
  tabTextOn: { color: colors.textPrimary },
  body: { flex: 1 },
  bodyContent: { gap: 12, paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.lg },
  message: { color: colors.textSecondary, fontSize: 14 },
  versionsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  versionsText: { color: colors.textPrimary, fontSize: 14 }
})
