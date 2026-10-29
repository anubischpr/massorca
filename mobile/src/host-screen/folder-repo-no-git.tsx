import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { REPO_INIT_GIT_RUNTIME_CAPABILITY } from '../../../src/shared/protocol-version'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

const LIMITATIONS = [
  'Isolated workspaces and branches',
  'Child sessions in their own worktree — they would edit the same files as the parent chat',
  'Changes, diffs, and commits',
  'Pull requests and reviews'
] as const

// Why: the pill is 20pt tall; this pads the touch area to 44pt without growing the section header.
const PILL_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 } as const

export function FolderRepoNoGitPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="No Git: show limitations"
      hitSlop={PILL_HIT_SLOP}
      onPress={onPress}
      style={styles.pill}
    >
      <Text style={styles.pillText}>No Git</Text>
    </Pressable>
  )
}

type ContentProps = {
  repoName: string
  hostCapabilities: readonly string[]
  connected: boolean
  initializing: boolean
  onInitialize: () => void
  onClose: () => void
}

export function FolderRepoNoGitContent({
  repoName,
  hostCapabilities,
  connected,
  initializing,
  onInitialize,
  onClose
}: ContentProps) {
  // Why: a host that predates repo.initGit answers without the capability; the sheet then only explains.
  const initGitSupported = hostCapabilities.includes(REPO_INIT_GIT_RUNTIME_CAPABILITY)
  return (
    <View style={styles.content}>
      <Text style={styles.title}>{`${repoName} has no Git`}</Text>
      <Text style={styles.bodySecondary}>Editor, terminal, and search work. Not available:</Text>
      <View style={styles.list}>
        {LIMITATIONS.map((item) => (
          <View key={item} style={styles.listRow}>
            <Text style={styles.bodyPrimary}>•</Text>
            <Text style={[styles.bodyPrimary, styles.listText]}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.bodySecondary}>
        Recommended only for exploring folders and non-development work.
      </Text>
      {initGitSupported ? (
        <>
          <Text style={styles.note}>
            Initialize Git runs git init on this host and creates an empty first commit. Your files
            are not committed.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Initialize Git"
            disabled={!connected || initializing}
            onPress={onInitialize}
            style={[styles.initButton, (!connected || initializing) && styles.disabled]}
          >
            <Text style={styles.initButtonText}>Initialize Git</Text>
            {initializing ? <ActivityIndicator size="small" color={colors.bgBase} /> : null}
          </Pressable>
        </>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>Close</Text>
      </Pressable>
    </View>
  )
}

type SheetProps = Omit<ContentProps, 'repoName'> & {
  visible: boolean
  repoName: string | null
  onClose: () => void
}

export function FolderRepoNoGitSheet({ visible, repoName, onClose, ...rest }: SheetProps) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <FolderRepoNoGitContent repoName={repoName ?? ''} onClose={onClose} {...rest} />
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  pill: {
    height: 20,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
    gap: spacing.md
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  bodySecondary: {
    fontSize: typography.bodySize,
    lineHeight: 21,
    color: colors.textSecondary
  },
  bodyPrimary: {
    fontSize: typography.bodySize,
    color: colors.textPrimary
  },
  list: {
    gap: spacing.sm
  },
  listRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  listText: {
    flex: 1
  },
  note: {
    fontSize: typography.metaSize,
    color: colors.textMuted
  },
  initButton: {
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  initButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.bgBase
  },
  disabled: {
    opacity: 0.58
  },
  closeButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    fontSize: 15,
    color: colors.textSecondary
  }
})
