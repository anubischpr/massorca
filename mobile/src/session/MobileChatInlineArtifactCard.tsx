import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronRight, FileCode } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MobileArtifactPagePreview } from './MobileArtifactPagePreview'
import type { MobileArtifactPage, MobileArtifactTarget } from './mobile-chat-artifacts-model'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import { useArtifactThumbnail } from './use-mobile-artifact-thumbnail'

const THUMBNAIL_SIZE = 64

/** The cards one turn carries, after its last message. */
export function MobileChatTurnArtifacts({
  pages,
  source,
  onOpen
}: {
  pages: readonly MobileArtifactPage[]
  source: MobileChatSurfaceRecordedSource | null
  onOpen: (target: MobileArtifactTarget) => void
}) {
  return (
    <>
      {pages.map((page) => (
        <MobileChatInlineArtifactCard
          key={JSON.stringify(page.target)}
          page={page}
          source={source}
          onOpen={onOpen}
        />
      ))}
    </>
  )
}

/** A page the turn wrote or showed, set in the transcript after that turn; a tap opens it. */
export function MobileChatInlineArtifactCard({
  page,
  source,
  onOpen
}: {
  page: MobileArtifactPage
  source: MobileChatSurfaceRecordedSource | null
  onOpen: (target: MobileArtifactTarget) => void
}) {
  // The card is in the transcript itself, so it is always near enough to read.
  const thumbnail = useArtifactThumbnail(page.target, source, true)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${page.name}`}
      onPress={() => onOpen(page.target)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        {thumbnail.kind === 'page' ? (
          <MobileArtifactPagePreview
            html={thumbnail.html}
            width={THUMBNAIL_SIZE}
            height={THUMBNAIL_SIZE}
          />
        ) : (
          <FileCode size={22} color={colors.textSecondary} strokeWidth={2} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {page.name}
        </Text>
        <Text style={styles.meta}>{page.label}</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  art: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radii.row,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  }
})
