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
import { canMerge } from '../../../src/shared/prototype-merge-state'
import {
  openDirection,
  toggleStar,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing } from '../theme/mobile-theme'
import { MobilePrototypeDirectionCard, PROTOTYPE_CARD_WIDTH } from './MobilePrototypeDirectionCard'
import { MobilePrototypeDirectionStrip } from './MobilePrototypeDirectionStrip'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypeMergeButton } from './MobilePrototypeMergeButton'
import { directionTag, mainFirst } from './mobile-prototype-directions-model'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { findMobilePrototypeSet } from './mobile-prototype-sets-state'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

const CARD_GAP = 12
const CARD_STEP = PROTOTYPE_CARD_WIDTH + CARD_GAP
const CAROUSEL_PADDING_Y = 16

/** One request's directions, swiped side by side; a tap opens one, and a star picks it for a merge. */
export function MobilePrototypeSetScreen({
  hostId,
  requestId,
  onBack,
  onOpenDirection
}: {
  hostId: string
  requestId: string
  onBack: () => void
  onOpenDirection: () => void
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

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <MobilePrototypeHeader
        title={set === null ? '' : prototypeTitle(set)}
        {...(set === null
          ? {}
          : {
              subtitle: `${mobilePrototypeAgentLabel(set.agent)} · ${directions.length} directions`
            })}
        backLabel="Back"
        onBack={onBack}
        trailing={
          state === undefined ? undefined : (
            <MobilePrototypeMergeButton
              starCount={state.starred.length}
              enabled={canMerge(state, nextLetter)}
              onPress={() => undefined}
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
              />
            ))}
      </ScrollView>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.dots}>
        {directions.map((direction, index) => (
          <View key={direction.letter} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.hint}>Swipe to compare · tap a design to open it</Text>
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
