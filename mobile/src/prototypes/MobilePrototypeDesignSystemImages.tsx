import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { ImagePlus } from 'lucide-react-native'
import type { DesignSystemDraftImage } from '../../../src/shared/prototype-design-system-view-state'
import { colors, typography } from '../theme/mobile-theme'
import type { MobileDesignSystemImageControls } from './mobile-prototype-design-system-images'

/** The draft's attached images as removable chips, and the attach button the phone composer uses. */
export function MobilePrototypeDesignSystemImages({
  images,
  control,
  onRemove
}: {
  images: readonly DesignSystemDraftImage[]
  control: MobileDesignSystemImageControls
  onRemove: (id: string) => void
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {images.map((image) => (
          <View key={image.id} style={styles.chip}>
            <Text style={styles.chipText}>{image.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${image.name}`}
              onPress={() => onRemove(image.id)}
              style={styles.remove}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach image"
          disabled={control.attaching}
          onPress={() => void control.attach()}
          style={styles.attach}
        >
          {control.attaching ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <ImagePlus size={18} color={colors.textSecondary} strokeWidth={2} />
          )}
        </Pressable>
      </View>
      {control.notice === null ? null : (
        <Text accessibilityRole="alert" style={styles.notice}>
          {control.notice}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.textSecondary, fontSize: 16 },
  attach: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  notice: { color: colors.statusRed, fontSize: typography.metaSize }
})
