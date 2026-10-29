import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
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
import { openDirection } from '../../../src/shared/prototype-set-state'
import { useHostClient } from '../transport/host-client-hooks'
import { colors, spacing } from '../theme/mobile-theme'
import { MobilePrototypeHeader } from './MobilePrototypeHeader'
import { MobilePrototypeTile } from './MobilePrototypeTile'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'
import { findMobilePrototypeSet } from './mobile-prototype-sets-state'
import { mobilePrototypeStateKey, useMobilePrototypeViewStore } from './mobile-prototype-view-store'
import { useMobilePrototypeSets } from './use-mobile-prototype-sets'

const CARD_WIDTH = 316
const CARD_GAP = 12
const CARD_STEP = CARD_WIDTH + CARD_GAP
const CAROUSEL_PADDING_Y = 16

/** One request's directions, swiped side by side; a tap opens one to iterate on. */
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
  const ensureSetState = useMobilePrototypeViewStore((s) => s.ensureSetState)
  const updateSetState = useMobilePrototypeViewStore((s) => s.updateSetState)
  const lettersKey = set?.directions.map((direction) => direction.letter).join('|') ?? ''
  useEffect(() => {
    if (lettersKey !== '') {
      ensureSetState(stateKey, lettersKey.split('|'))
    }
  }, [ensureSetState, lettersKey, stateKey])
  const [page, setPage] = useState(0)
  const [areaHeight, setAreaHeight] = useState(0)
  const scrolled = useRef(0)

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    scrolled.current = event.nativeEvent.contentOffset.x
    setPage(Math.round(scrolled.current / CARD_STEP))
  }
  const directions = set?.directions ?? []

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
      />
      <ScrollView
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
        {set === null || areaHeight === 0
          ? null
          : directions.map((direction) => (
              <View
                key={direction.letter}
                style={[styles.card, { height: areaHeight - CAROUSEL_PADDING_Y * 2 }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Iterate on direction ${direction.letter}`}
                  onPress={() => {
                    updateSetState(stateKey, (current) => openDirection(current, direction.letter))
                    onOpenDirection()
                  }}
                  style={styles.cardArt}
                >
                  <MobilePrototypeTile
                    client={client}
                    set={set}
                    direction={direction}
                    style={styles.cardTile}
                  />
                </Pressable>
                <View style={styles.cardText}>
                  <Text style={styles.cardName}>
                    {direction.name === undefined
                      ? direction.letter
                      : `${direction.letter} · ${direction.name}`}
                  </Text>
                  {direction.tradeoff === undefined ? null : (
                    <Text style={styles.cardTradeoff}>{direction.tradeoff}</Text>
                  )}
                </View>
              </View>
            ))}
      </ScrollView>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.dots}>
        {directions.map((direction, index) => (
          <View key={direction.letter} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.hint}>Swipe to compare · tap a design to iterate on it</Text>
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
  card: { width: CARD_WIDTH, gap: spacing.md },
  cardArt: { flex: 1 },
  cardTile: { flex: 1, borderRadius: 14 },
  cardText: { gap: 2 },
  cardName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardTradeoff: { color: colors.textSecondary, fontSize: 13 },
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
