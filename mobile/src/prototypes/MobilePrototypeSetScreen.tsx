import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { prototypeTitle } from '../../../src/shared/prototype-list-model'
import { nextFreeDirectionLetter } from '../../../src/shared/prototype-merge-plan'
import { cancelMerge, canMerge, planArrived } from '../../../src/shared/prototype-merge-state'
import {
  openDirection,
  toggleStar,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { ActionSheetModal } from '../components/ActionSheetModal'
import { KeyedBottomDrawer } from '../components/keyed-bottom-drawer'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing } from '../theme/mobile-theme'
import { MobilePrototypeDirectionCard, PROTOTYPE_CARD_WIDTH } from './MobilePrototypeDirectionCard'
import { MobilePrototypeDirectionStrip } from './MobilePrototypeDirectionStrip'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypeMergeButton } from './MobilePrototypeMergeButton'
import { MobilePrototypeMergeSheet } from './MobilePrototypeMergeSheet'
import { MobilePrototypeMergeSkeleton } from './MobilePrototypeMergeSkeleton'
import { MobilePrototypeVersionsSheet } from './MobilePrototypeVersionsSheet'
import { directionTag, mainFirst } from './mobile-prototype-directions-model'
import type { MobilePrototypeVersionRow } from './mobile-prototype-versions-model'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { originChipOf } from './mobile-prototype-origin'
import { sendMobilePrototypeMerge, startMobilePrototypeMerge } from './mobile-prototype-merge-flow'
import { findMobilePrototypeSet } from './mobile-prototype-sets-state'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeMergePlan } from './use-mobile-prototype-merge-plan'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'
import { useOpenMobileSession } from '../session/use-open-mobile-session'
import { useWorktreeAgentRows } from '../session/use-worktree-agent-rows'

const CARD_GAP = 12
const CARD_STEP = PROTOTYPE_CARD_WIDTH + CARD_GAP
const CAROUSEL_PADDING_Y = 16

/** One request's directions, swiped side by side; a tap opens one, and a star picks it for a merge. */
export function MobilePrototypeSetScreen({
  hostId,
  requestId,
  onBack,
  onOpenDirection,
  onOpenVersion
}: {
  hostId: string
  requestId: string
  onBack: () => void
  onOpenDirection: () => void
  /** Opens an earlier version of a direction, read-only. */
  onOpenVersion: (version: number) => void
}) {
  const { client } = useHostClient(hostId)
  const listed = useMobilePrototypeSets(hostId)
  const set = findMobilePrototypeSet(listed, requestId)
  const { worktrees } = useWorktreeAgentRows(client)
  const openSession = useOpenMobileSession()
  // Why: a parent chat with no name still opens; only a parent the host does not list has nowhere to go.
  const originChip = originChipOf(set?.origin, worktrees, (chat) =>
    openSession({ hostId, worktreeId: chat.worktreeId, paneKey: chat.paneKey })
  )
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
  const [page, setPage] = useState(0)
  const [areaHeight, setAreaHeight] = useState(0)
  const carousel = useRef<ScrollView>(null)

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / CARD_STEP))
  }
  const directions =
    set === null || state === undefined ? [] : mainFirst(set.directions, state.active)
  const focusLetter = directions[page]?.letter ?? null
  const focusDirection = (letter: string): void => {
    const index = directions.findIndex((direction) => direction.letter === letter)
    if (index !== -1) {
      setPage(index)
      carousel.current?.scrollTo({ x: index * CARD_STEP, animated: true })
    }
  }
  const nextLetter = nextFreeDirectionLetter(directions.map((direction) => direction.letter))
  useMobilePrototypeMergePlan(client, set, state?.merge, (plan, text) =>
    update((current) => planArrived(current, plan, text))
  )
  const mergeFlow = (listedSet: PrototypeListedSet) => ({
    client,
    set: listedSet,
    nextLetter,
    getState: () => useMobilePrototypeViewStore.getState().states[stateKey],
    update
  })
  const review = state?.merge?.phase === 'review' ? state.merge : null
  // Why: a merge waiting for its plan opens the sheet as a skeleton, so the wait is not a blank screen.
  const mergeUnderWay = (state?.merge ?? null) !== null
  // The letters stay once picked, so the menu and the Versions sheet keep their content while they close.
  const [menuLetter, setMenuLetter] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [versionsLetter, setVersionsLetter] = useState<string | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  // Why: iOS cannot present the viewer over a Versions sheet still closing, so the pick waits for it.
  const pendingVersionPick = useRef<MobilePrototypeVersionRow | null>(null)
  const versionsDirection = set?.directions.find((direction) => direction.letter === versionsLetter)
  const openVersions = (letter: string): void => {
    setVersionsLetter(letter)
    setVersionsOpen(true)
  }
  const pickVersion = (letter: string, row: MobilePrototypeVersionRow): void => {
    update((current) => openDirection(current, letter))
    pendingVersionPick.current = row
    setVersionsOpen(false)
  }
  const openPickedVersion = (): void => {
    const row = pendingVersionPick.current
    pendingVersionPick.current = null
    if (row === null) {
      return
    }
    if (row.current) {
      onOpenDirection()
    } else {
      onOpenVersion(row.version)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader
        title={set === null ? '' : prototypeTitle(set)}
        {...(set === null
          ? {}
          : {
              subtitle: `${mobilePrototypeAgentLabel(set.agent)} · ${directions.length} directions`,
              ...(originChip === null ? {} : { origin: originChip })
            })}
        backLabel="Back"
        onBack={onBack}
        trailing={
          state === undefined ? undefined : (
            <MobilePrototypeMergeButton
              starCount={state.starred.length}
              enabled={canMerge(state, nextLetter)}
              onPress={() =>
                set === null ? undefined : void startMobilePrototypeMerge(mergeFlow(set))
              }
            />
          )
        }
      />
      {set === null || state === undefined ? null : (
        <MobilePrototypeDirectionStrip
          directions={set.directions}
          state={state}
          focusLetter={focusLetter}
          onFocus={focusDirection}
        />
      )}
      <ScrollView
        ref={carousel}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STEP}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={onScroll}
        onLayout={(event: LayoutChangeEvent) => setAreaHeight(event.nativeEvent.layout.height)}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {set === null || state === undefined || areaHeight === 0
          ? null
          : directions.map((direction) => (
              <MobilePrototypeDirectionCard
                key={direction.letter}
                client={client}
                set={set}
                direction={direction}
                tag={directionTag(state, direction.letter)}
                starred={state.starred.includes(direction.letter)}
                height={areaHeight - CAROUSEL_PADDING_Y * 2}
                onOpen={() => {
                  update((current) => openDirection(current, direction.letter))
                  onOpenDirection()
                }}
                onToggleStar={() => update((current) => toggleStar(current, direction.letter))}
                onMore={() => {
                  setMenuLetter(direction.letter)
                  setMenuOpen(true)
                }}
              />
            ))}
      </ScrollView>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.dots}>
        {directions.map((direction, index) => (
          <View key={direction.letter} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.hint}>Swipe to compare · tap a design to open it</Text>
      <KeyedBottomDrawer<'merge'>
        sheet={!mergeUnderWay || set === null || nextLetter === null ? null : 'merge'}
        sheetKey={(presented) => presented}
        contentScrollable={false}
        dragContentToDismiss={false}
        onClose={() => update(cancelMerge)}
      >
        {() =>
          !mergeUnderWay || set === null || nextLetter === null ? null : review === null ? (
            <MobilePrototypeMergeSkeleton />
          ) : (
            <MobilePrototypeMergeSheet
              client={client}
              set={set}
              review={review}
              agentName={mobilePrototypeAgentLabel(set.agent)}
              nextLetter={nextLetter}
              sendFailed={state?.mergeSendFailed ?? false}
              update={update}
              onSend={() => void sendMobilePrototypeMerge(mergeFlow(set))}
            />
          )
        }
      </KeyedBottomDrawer>
      <ActionSheetModal
        visible={menuOpen}
        title={menuLetter === null ? undefined : `Direction ${menuLetter}`}
        actions={
          menuLetter === null
            ? []
            : [
                {
                  label: 'Versions',
                  // Why: the Versions sheet opens only after this menu has closed on iOS.
                  closeBeforePress: true,
                  onPress: () => openVersions(menuLetter)
                }
              ]
        }
        onClose={() => setMenuOpen(false)}
      />
      <KeyedBottomDrawer<'versions'>
        sheet={versionsOpen && set !== null && versionsLetter !== null ? 'versions' : null}
        sheetKey={(presented) => presented}
        onClose={() => setVersionsOpen(false)}
        onAfterClose={openPickedVersion}
      >
        {() =>
          set === null || versionsLetter === null ? null : (
            <MobilePrototypeVersionsSheet
              letter={versionsLetter}
              direction={versionsDirection}
              onPick={(row) => pickVersion(versionsLetter, row)}
            />
          )
        }
      </KeyedBottomDrawer>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  carousel: { flex: 1 },
  carouselContent: {
    gap: CARD_GAP,
    paddingHorizontal: spacing.xl,
    paddingVertical: CAROUSEL_PADDING_Y
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  dotActive: { backgroundColor: colors.textPrimary },
  hint: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 30,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  }
})
