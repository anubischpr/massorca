import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import type { PrototypeDraftField, PrototypeDraftItem } from '../../../src/shared/prototype-draft'
import {
  backToActive,
  closeSelection,
  makeMain,
  isReadOnlyView,
  jumpToDraftItem,
  openDirection,
  pickElement,
  pinClicked,
  selectedPinOf,
  setTool,
  setViewport,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import {
  annotateStateOf,
  beginSend,
  draftOf,
  sendRefused,
  sendSucceeded
} from '../../../src/shared/prototype-set-view'
import { KeyedBottomDrawer } from '../components/keyed-bottom-drawer'
import { hostMayRestorePrototypeVersions } from '../session/mobile-prototype-host-rpc'
import { useOpenMobileSession } from '../session/use-open-mobile-session'
import { useWorktreeAgentRows } from '../session/use-worktree-agent-rows'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { MobilePrototypeDraftSheet } from './MobilePrototypeDraftSheet'
import { MobilePrototypeFrame } from './MobilePrototypeFrame'
import type { MobilePrototypeFrameHandle } from './mobile-prototype-capture-math'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypePinSheet, type MobilePrototypePinTab } from './MobilePrototypePinSheet'
import { MobilePrototypeReadOnlyBanner } from './MobilePrototypeReadOnlyBanner'
import { MobilePrototypeReadOnlySheet } from './MobilePrototypeReadOnlySheet'
import { MobilePrototypeViewportToggle } from './MobilePrototypeViewportToggle'
import { sendMobilePrototypeIteration } from './mobile-prototype-iteration-send'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { originChipOf } from './mobile-prototype-origin'
import { findMobilePrototypeSet } from './mobile-prototype-sets-state'
import { pulseFieldFor, viewerChips, viewerHeaderLines } from './mobile-prototype-viewer-model'
import { MobilePrototypeRestoreBar } from './MobilePrototypeRestoreBar'
import { canRestoreVersions, earlierVersionHeader } from './mobile-prototype-versions-model'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeFile } from './use-mobile-prototype-file'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

type Sheet = 'pin' | 'draft'

/** The control a draft item jumped to, kept while its pin is the one open. */
type Jump = { letter: string; pinKey: string; field: PrototypeDraftField; nonce: number }

// An earlier version is read-only: its pins belong to the current file, so none are drawn or picked.
const NO_ANNOTATE: NativeChatVisualAnnotateState = { enabled: false, pins: [], overrides: [] }

/**
 * One prototype: its direction chips, the live page with its pins, and the Browse and Annotate tools.
 * With `earlierVersion`, one earlier version of its direction, read-only, with Restore when offered.
 */
export function MobilePrototypeViewerScreen({
  hostId,
  requestId,
  earlierVersion = null,
  onBack
}: {
  hostId: string
  requestId: string
  earlierVersion?: number | null
  onBack: () => void
}) {
  const { client } = useHostClient(hostId)
  const { worktrees } = useWorktreeAgentRows(client)
  const openSession = useOpenMobileSession()
  const listed = useMobilePrototypeSets(hostId)
  const set = findMobilePrototypeSet(listed, requestId)
  const stateKey = mobilePrototypeStateKey(hostId, requestId)
  const state = useMobilePrototypeViewStore((s) => s.states[stateKey])
  const ensureSetState = useMobilePrototypeViewStore((s) => s.ensureSetState)
  const updateSetState = useMobilePrototypeViewStore((s) => s.updateSetState)
  const lettersKey = set?.directions.map((direction) => direction.letter).join('|') ?? ''
  useEffect(() => {
    if (lettersKey !== '') {
      ensureSetState(stateKey, lettersKey.split('|'))
    }
  }, [ensureSetState, lettersKey, stateKey])
  const update = useCallback(
    (transform: (current: PrototypeSetState) => PrototypeSetState) =>
      updateSetState(stateKey, transform),
    [stateKey, updateSetState]
  )
  const [pinTab, setPinTab] = useState<MobilePrototypePinTab>('edit')
  const [draftOpen, setDraftOpen] = useState(false)
  const frameHandle = useRef<MobilePrototypeFrameHandle | null>(null)
  const [jump, setJump] = useState<Jump | null>(null)
  const [hostLacksRestore, setHostLacksRestore] = useState(false)

  const viewDirection = set?.directions.find((direction) => direction.letter === state?.view)
  const latest = latestVersionOf(viewDirection)
  // Why: an earlier version is shown by its own file; the current one by the latest file.
  const shown =
    earlierVersion === null
      ? latest
      : (viewDirection?.versions.find((version) => version.version === earlierVersion) ?? null)
  const file = useMobilePrototypeFile(
    client,
    set === null || shown === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: shown.fileName }
  )
  const onAnnotateEvent = useCallback(
    (event: NativeChatVisualAnnotateEvent) =>
      update((current) =>
        event.kind === 'element-picked'
          ? pickElement(current, event.element)
          : pinClicked(current, event.pinKey)
      ),
    [update]
  )

  const send = useCallback(async (): Promise<void> => {
    const current = useMobilePrototypeViewStore.getState().states[stateKey]
    if (set === null || current === undefined || current.sending) {
      return
    }
    update(beginSend)
    const outcome = await sendMobilePrototypeIteration(current, set, client, frameHandle.current)
    update((latest) =>
      outcome.sent ? sendSucceeded(latest, outcome.visibleMessage) : sendRefused(latest)
    )
  }, [client, set, stateKey, update])
  const jumpTo = useCallback(
    (item: PrototypeDraftItem) => {
      setDraftOpen(false)
      setPinTab(item.field === 'note' ? 'note' : 'edit')
      setJump((previous) => ({
        letter: item.letter,
        pinKey: item.pinKey,
        field: item.field,
        nonce: (previous?.nonce ?? 0) + 1
      }))
      update((current) =>
        jumpToDraftItem(current, { letter: item.letter, pinKey: item.pinKey, field: item.field })
      )
    },
    [update]
  )

  if (set === null || state === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <MobilePrototypeHeader title="" onBack={onBack} />
      </SafeAreaView>
    )
  }
  const lines =
    earlierVersion === null
      ? viewerHeaderLines(set, state)
      : earlierVersionHeader(state.view, earlierVersion)
  const chips = earlierVersion === null ? viewerChips(set, state) : []
  const originChip = originChipOf(set.origin, worktrees, (chat) =>
    openSession({ hostId, worktreeId: chat.worktreeId, paneKey: chat.paneKey })
  )
  const pin = selectedPinOf(state)
  const agentName = mobilePrototypeAgentLabel(set.agent)
  const sheet: Sheet | null =
    earlierVersion !== null ? null : draftOpen ? 'draft' : pin === null ? null : 'pin'
  const pulseField = pulseFieldFor(jump, state)
  // Why: a host that lacks restore is remembered per connection, and this screen re-reads it on the next tap.
  const restoreHost =
    client !== null &&
    earlierVersion !== null &&
    latest !== null &&
    canRestoreVersions(set, !hostLacksRestore && hostMayRestorePrototypeVersions(client))
      ? client
      : null

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader
        title={lines.title}
        subtitle={lines.subtitle}
        {...(originChip === null ? {} : { origin: originChip })}
        backLabel={earlierVersion !== null || chips.length > 0 ? 'Back to the set' : 'Back'}
        onBack={onBack}
        trailing={
          <MobilePrototypeViewportToggle
            viewport={state.viewport}
            onChange={(viewport) => update((current) => setViewport(current, viewport))}
          />
        }
      />
      {chips.length === 0 ? null : (
        <ScrollView
          horizontal
          accessibilityLabel="Directions in this set"
          showsHorizontalScrollIndicator={false}
          style={styles.chipsBar}
          contentContainerStyle={styles.chips}
        >
          {chips.map((chip) => (
            <Pressable
              key={chip.letter}
              accessibilityRole="button"
              accessibilityState={{ selected: chip.selected }}
              hitSlop={{ top: 4, bottom: 4 }}
              onPress={() =>
                update((current) =>
                  chip.letter === current.active
                    ? backToActive(current)
                    : openDirection(current, chip.letter)
                )
              }
              style={[styles.chip, chip.selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, chip.selected && styles.chipTextOn]}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {isReadOnlyView(state) && earlierVersion === null ? (
        <MobilePrototypeReadOnlyBanner
          view={state.view}
          main={state.active}
          onBackToMain={() => update(backToActive)}
          onMakeMain={() => update(makeMain)}
        />
      ) : null}
      <MobilePrototypeFrame
        file={file}
        fileKey={`${set.requestId}:${shown?.fileName ?? ''}`}
        viewport={state.viewport}
        annotate={earlierVersion === null ? annotateStateOf(state, state.view) : NO_ANNOTATE}
        onAnnotateEvent={onAnnotateEvent}
        handle={frameHandle}
      />
      {earlierVersion !== null ? (
        restoreHost !== null && latest !== null ? (
          <MobilePrototypeRestoreBar
            client={restoreHost}
            set={set}
            letter={state.view}
            version={earlierVersion}
            latestVersion={latest.version}
            onRestored={() => {
              listed.reload()
              onBack()
            }}
            onUnsupported={() => setHostLacksRestore(true)}
          />
        ) : null
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDraftOpen(true)}
            style={styles.draftBar}
          >
            <Text style={styles.draftCount}>{draftOf(state).itemCount}</Text>
            <Text style={styles.draftLabel}>{`items ready for ${agentName}`}</Text>
            <Text style={styles.draftAction}>Review &amp; send ›</Text>
          </Pressable>
          <View
            accessibilityRole="toolbar"
            accessibilityLabel="Prototype tools"
            style={styles.toolbar}
          >
            {(['browse', 'annotate'] as const).map((tool) => (
              <Pressable
                key={tool}
                accessibilityRole="button"
                accessibilityState={{ selected: state.tool === tool }}
                onPress={() => update((current) => setTool(current, tool))}
                style={[styles.tool, state.tool === tool && styles.toolOn]}
              >
                <Text style={[styles.toolText, state.tool === tool && styles.toolTextOn]}>
                  {tool === 'browse' ? 'Browse' : 'Annotate'}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <KeyedBottomDrawer<Sheet>
        sheet={sheet}
        sheetKey={(presented) => presented}
        contentScrollable={false}
        dragContentToDismiss={false}
        onClose={(presented) => {
          if (presented === 'draft') {
            setDraftOpen(false)
            return
          }
          setJump(null)
          update(closeSelection)
        }}
      >
        {(presented) =>
          presented === 'draft' ? (
            <MobilePrototypeDraftSheet
              agentName={agentName}
              state={state}
              update={update}
              onClose={() => setDraftOpen(false)}
              onJump={jumpTo}
              onSend={() => void send()}
            />
          ) : pin === null ? null : isReadOnlyView(state) ? (
            <MobilePrototypeReadOnlySheet
              key={`${state.view}:${pin.pinKey}`}
              pin={pin}
              state={state}
              update={update}
            />
          ) : (
            // Keyed by the pin, so a value typed into one pin's field never shows on the next pin.
            <MobilePrototypePinSheet
              key={`${state.view}:${pin.pinKey}`}
              pin={pin}
              state={state}
              update={update}
              tab={pinTab}
              onTab={setPinTab}
              pulseField={pulseField}
              pulseNonce={jump?.nonce ?? 0}
            />
          )
        }
      </KeyedBottomDrawer>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  chipsBar: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  chip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipOn: { backgroundColor: colors.textPrimary },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  chipTextOn: { color: colors.bgBase },
  draftBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  draftCount: {
    paddingVertical: 1,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.textPrimary,
    color: colors.bgBase,
    fontFamily: typography.monoFamily,
    fontSize: 12
  },
  draftLabel: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  draftAction: { color: colors.textSecondary, fontSize: 14 },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm
  },
  tool: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  toolOn: { backgroundColor: colors.bgRaised },
  toolText: { color: colors.textSecondary, fontSize: 13 },
  toolTextOn: { color: colors.textPrimary }
})
