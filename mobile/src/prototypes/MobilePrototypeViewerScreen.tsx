import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeChatVisualAnnotateEvent } from '../../../src/shared/native-chat-visual-annotate'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import type { PrototypeDraftField, PrototypeDraftItem } from '../../../src/shared/prototype-draft'
import {
  backToActive,
  closeSelection,
  iterateHere,
  jumpToDraftItem,
  peekDirection,
  pickElement,
  pinClicked,
  selectedPinOf,
  setTool,
  setViewport,
  type PrototypeSetState,
  type PrototypeViewport
} from '../../../src/shared/prototype-set-state'
import {
  annotateStateOf,
  beginSend,
  draftOf,
  sendRefused,
  sendSucceeded
} from '../../../src/shared/prototype-set-view'
import { KeyedBottomDrawer } from '../components/keyed-bottom-drawer'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { MobilePrototypeDraftSheet } from './MobilePrototypeDraftSheet'
import { MobilePrototypeFrame } from './MobilePrototypeFrame'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypePinSheet, type MobilePrototypePinTab } from './MobilePrototypePinSheet'
import { sendMobilePrototypeIteration } from './mobile-prototype-iteration-send'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { findMobilePrototypeSet } from './mobile-prototype-sets-state'
import { isPeeking, viewerChips, viewerHeaderLines } from './mobile-prototype-viewer-model'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeFile } from './use-mobile-prototype-file'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

type Sheet = 'pin' | 'draft'

/** The control a draft item jumped to, kept while its pin is the one open. */
type Jump = { letter: string; pinKey: string; field: PrototypeDraftField; nonce: number }

const VIEWPORTS: readonly { viewport: PrototypeViewport; label: string }[] = [
  { viewport: 'phone', label: 'Phone' },
  { viewport: 'desktop', label: 'Desktop' }
]

/** One prototype: its direction chips, the live page with its pins, and the Browse and Annotate tools. */
export function MobilePrototypeViewerScreen({
  hostId,
  requestId,
  onBack
}: {
  hostId: string
  requestId: string
  onBack: () => void
}) {
  const { client } = useHostClient(hostId)
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
  const [jump, setJump] = useState<Jump | null>(null)

  const viewDirection = set?.directions.find((direction) => direction.letter === state?.view)
  const latest = latestVersionOf(viewDirection)
  const file = useMobilePrototypeFile(
    client,
    set === null || latest === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: latest.fileName }
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
    const outcome = await sendMobilePrototypeIteration(current, set)
    update((latest) =>
      outcome.sent ? sendSucceeded(latest, outcome.visibleMessage) : sendRefused(latest)
    )
  }, [set, stateKey, update])
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
  const lines = viewerHeaderLines(set, state)
  const chips = viewerChips(set, state)
  const pin = selectedPinOf(state)
  const agentName = mobilePrototypeAgentLabel(set.agent)
  const sheet: Sheet | null = draftOpen ? 'draft' : pin === null ? null : 'pin'
  const pulsing =
    jump !== null && jump.pinKey === state.selectedPinKey && jump.letter === state.view

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader
        title={lines.title}
        subtitle={lines.subtitle}
        backLabel={chips.length > 0 ? 'Back to the set' : 'Back'}
        onBack={onBack}
        trailing={
          <View accessibilityLabel="Viewport" style={styles.segment}>
            {VIEWPORTS.map(({ viewport, label }) => (
              <Pressable
                key={viewport}
                accessibilityRole="button"
                accessibilityState={{ selected: state.viewport === viewport }}
                hitSlop={{ top: 6, bottom: 6 }}
                onPress={() => update((current) => setViewport(current, viewport))}
                style={[styles.segmentButton, state.viewport === viewport && styles.segmentOn]}
              >
                <Text
                  style={[styles.segmentText, state.viewport === viewport && styles.segmentTextOn]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
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
                    : peekDirection(current, chip.letter)
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
      {isPeeking(state) ? (
        <View accessibilityRole="summary" style={styles.peek}>
          <Text style={styles.peekText}>
            {`Peeking at ${state.view} while iterating on `}
            <Text style={styles.peekBold}>{state.active}</Text>
            {`. Notes here go in as “take this from ${state.view} into ${state.active}”.`}
          </Text>
          <View style={styles.peekActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => update(backToActive)}
              style={styles.peekButton}
            >
              <Text style={styles.peekButtonText}>{`Back to ${state.active}`}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => update(iterateHere)}
              style={styles.peekButton}
            >
              <Text style={styles.peekButtonText}>{`Iterate on ${state.view}`}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <MobilePrototypeFrame
        file={file}
        fileKey={`${set.requestId}:${latest?.fileName ?? ''}`}
        viewport={state.viewport}
        annotate={annotateStateOf(state, state.view)}
        onAnnotateEvent={onAnnotateEvent}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => setDraftOpen(true)}
        style={styles.draftBar}
      >
        <Text style={styles.draftCount}>{draftOf(state).itemCount}</Text>
        <Text style={styles.draftLabel}>{`items ready for ${agentName}`}</Text>
        <Text style={styles.draftAction}>Review &amp; send ›</Text>
      </Pressable>
      <View accessibilityRole="toolbar" accessibilityLabel="Prototype tools" style={styles.toolbar}>
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
          ) : pin === null ? null : (
            <MobilePrototypePinSheet
              pin={pin}
              state={state}
              update={update}
              tab={pinTab}
              onTab={setPinTab}
              pulseField={pulsing ? (jump?.field ?? null) : null}
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
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  segmentButton: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8
  },
  segmentOn: { backgroundColor: colors.bgRaised },
  segmentText: { color: colors.textSecondary, fontSize: 12 },
  segmentTextOn: { color: colors.textPrimary },
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
  peek: {
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted
  },
  peekText: { color: colors.textPrimary, fontSize: 13, lineHeight: 20 },
  peekBold: { fontWeight: '700' },
  peekActions: { flexDirection: 'row', gap: spacing.sm },
  peekButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  peekButtonText: { color: colors.textPrimary, fontSize: 13 },
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
