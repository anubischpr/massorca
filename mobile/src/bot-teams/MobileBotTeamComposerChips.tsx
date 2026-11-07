import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { MobileFileTypeIcon } from '../components/MobileFileTypeIcon'
import { colors, radii, spacing } from '../theme/mobile-theme'
import { targetIcon } from './MobileBotTeamMentionChip'
import type { MobileBotTeamDraftMention } from './mobile-bot-team-mention'

/** The file's name, the alert's title: its last path segment. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * The pills a composer draft shows above its input, one per mention, each with an x that takes it
 * out of the draft. A long press on a file pill shows its full path.
 */
export function MobileBotTeamComposerChips({
  mentions,
  onRemove
}: {
  mentions: readonly MobileBotTeamDraftMention[]
  onRemove: (mention: MobileBotTeamDraftMention) => void
}) {
  if (mentions.length === 0) {
    return null
  }
  return (
    <View style={styles.row}>
      {mentions.map((mention) => {
        const label = mention.kind === 'file' ? mention.path : mention.target.name
        const icon =
          mention.kind === 'file' ? (
            <MobileFileTypeIcon path={mention.path} size={12} />
          ) : (
            targetIcon(mention.target)
          )
        const name = (
          <>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={styles.name} numberOfLines={1}>
              {label}
            </Text>
          </>
        )
        return (
          <View key={mention.start} style={styles.pill}>
            {mention.kind === 'file' ? (
              <Pressable
                style={styles.body}
                onLongPress={() => Alert.alert(fileName(mention.path), mention.path)}
              >
                {name}
              </Pressable>
            ) : (
              <View style={styles.body}>{name}</View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label}`}
              onPress={() => onRemove(mention)}
              hitSlop={8}
            >
              <X size={12} color={colors.textSecondary} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 220,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  body: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  icon: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 12
  }
})
