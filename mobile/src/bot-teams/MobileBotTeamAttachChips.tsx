import { Pressable, StyleSheet, Text, View } from 'react-native'
import { FileText, X } from 'lucide-react-native'
import type { BotTeamRoomAttachment } from '../../../src/shared/bot-team-room-attachments'
import { colors, radii, spacing } from '../theme/mobile-theme'

/**
 * The files a room message carries, or the files waiting to go with the next one. A removable row
 * passes `onRemove`; `inset` lines the row up with the composer beneath it.
 */
export function MobileBotTeamAttachChips({
  files,
  onRemove,
  inset = false,
  tag
}: {
  files: readonly BotTeamRoomAttachment[]
  onRemove?: (path: string) => void
  inset?: boolean
  /** Names where the files came from, such as "From Warehouse". */
  tag?: string
}) {
  if (files.length === 0) {
    return null
  }
  return (
    <View style={[styles.row, inset ? styles.inset : null]}>
      {files.map((file) => (
        <View key={file.path} style={styles.chip}>
          <FileText size={12} color={colors.textSecondary} />
          <Text style={styles.name} numberOfLines={1}>
            {file.name}
          </Text>
          {tag ? <Text style={styles.tag}>{tag}</Text> : null}
          {onRemove ? (
            <Pressable
              accessibilityLabel={`Remove ${file.name}`}
              onPress={() => onRemove(file.path)}
              hitSlop={8}
            >
              <X size={12} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  inset: {
    paddingHorizontal: spacing.md
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 220,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  tag: { color: colors.textMuted, fontSize: 11 },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 12
  }
})
