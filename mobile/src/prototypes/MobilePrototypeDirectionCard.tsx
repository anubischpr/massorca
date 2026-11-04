import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'
import { colors, spacing } from '../theme/mobile-theme'
import { directionCardLine, starLabelFor } from './mobile-prototype-directions-model'
import { MobilePrototypeStarIcon } from './MobilePrototypeStarIcon'
import { MobilePrototypeTile } from './MobilePrototypeTile'

export const PROTOTYPE_CARD_WIDTH = 316

/** One direction of the swipe set: its page to open, its star for merge, its name, tag and tradeoff. */
export function MobilePrototypeDirectionCard({
  client,
  set,
  direction,
  tag,
  starred,
  height,
  onOpen,
  onToggleStar,
  onMore
}: {
  client: RpcClient | null
  set: PrototypeListedSet
  direction: PrototypeListedDirection
  tag: string
  starred: boolean
  height: number
  onOpen: () => void
  onToggleStar: () => void
  onMore: () => void
}) {
  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.art}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open direction ${direction.letter}`}
          onPress={onOpen}
          style={styles.open}
        >
          <MobilePrototypeTile
            client={client}
            set={set}
            direction={direction}
            style={styles.tile}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={starLabelFor(direction.letter, starred)}
          accessibilityState={{ selected: starred }}
          onPress={onToggleStar}
          style={styles.star}
        >
          <MobilePrototypeStarIcon
            size={20}
            filled={starred}
            color={starred ? colors.statusAmber : colors.textPrimary}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>
      <View style={styles.footer}>
        <View style={styles.text}>
          <Text style={styles.name}>{directionCardLine(direction, tag)}</Text>
          {direction.tradeoff === undefined ? null : (
            <Text style={styles.tradeoff}>{direction.tradeoff}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More for direction ${direction.letter}`}
          onPress={onMore}
          hitSlop={4}
          style={styles.more}
        >
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { width: PROTOTYPE_CARD_WIDTH, gap: spacing.md },
  art: { flex: 1 },
  open: { flex: 1 },
  tile: { flex: 1, borderRadius: 14 },
  star: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.scrimOverTile
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.textSecondary, fontSize: 20 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  tradeoff: { color: colors.textSecondary, fontSize: 13 }
})
