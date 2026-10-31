import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { PrototypeOriginChip } from './mobile-prototype-origin'

/** The Prototypes screens' navigation bar: Back, the title (with an optional second line), and a trailing control. */
export function MobilePrototypeHeader({
  title,
  subtitle,
  origin,
  backLabel = 'Back',
  onBack,
  trailing
}: {
  title: string
  subtitle?: string
  /** The parent chat a set came from, as a chip under the title. */
  origin?: PrototypeOriginChip
  backLabel?: string
  onBack: () => void
  trailing?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.back}
      >
        <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle || origin ? (
          <View style={styles.subtitleRow}>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {origin ? <OriginChip origin={origin} /> : null}
          </View>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

/** The parent chat as a chip: "from parent chat" while its name is unknown, and a tap opens it. */
function OriginChip({ origin }: { origin: PrototypeOriginChip }) {
  const base = origin.title === null ? 'from parent chat' : `from “${origin.title}”`
  const openable = origin.onPress !== null
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Parent chat, ${base}`}
      accessibilityState={{ disabled: !openable }}
      disabled={!openable}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={origin.onPress ?? undefined}
      style={styles.originChip}
    >
      <Text style={styles.originText} numberOfLines={1}>
        {openable ? `${base} ›` : base}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600'
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0
  },
  subtitle: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  originChip: {
    flexShrink: 0,
    maxWidth: 200,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  originText: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    textAlign: 'center'
  }
})
