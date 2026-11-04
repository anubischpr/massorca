import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { designSystemRestoreFailureAlert } from './mobile-prototype-design-system-version-restore'
import {
  designSystemRestoreConfirmOf,
  designSystemRestoreLabelOf
} from './mobile-prototype-design-system-versions-model'
import { restoreMobilePrototypeDesignSystemVersion } from './mobile-prototype-design-system-version-rpc'

/** The banner of an earlier design system version: read-only, with Restore as the next version after a confirm. */
export function MobilePrototypeDesignSystemVersionBanner({
  client,
  sessionId,
  version,
  latestVersion,
  onBackToCurrent,
  onRestored
}: {
  client: RpcClient
  sessionId: string
  version: number
  latestVersion: number
  onBackToCurrent: () => void
  onRestored: (version: number) => void
}) {
  const [restoring, setRestoring] = useState(false)
  const restore = async (): Promise<void> => {
    setRestoring(true)
    const outcome = await restoreMobilePrototypeDesignSystemVersion(client, { sessionId, version })
    setRestoring(false)
    if (outcome.kind === 'restored') {
      onRestored(outcome.version)
      return
    }
    const failure = designSystemRestoreFailureAlert(outcome)
    if (failure !== null) {
      Alert.alert(failure.title, failure.message)
    }
  }
  // Why: a restore is a new current version, so it asks first; nothing is removed.
  const confirm = (): void => {
    const question = designSystemRestoreConfirmOf(version, latestVersion)
    Alert.alert(question.title, question.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: () => void restore() }
    ])
  }
  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Text style={styles.title}>{`Viewing v${version} · read-only`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to current"
          onPress={onBackToCurrent}
          style={styles.back}
        >
          <Text style={styles.backText}>Back to current</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: restoring }}
        disabled={restoring}
        onPress={confirm}
        style={[styles.restore, restoring && styles.restoreBusy]}
      >
        <Text style={styles.restoreText}>{designSystemRestoreLabelOf(latestVersion)}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.textSecondary, fontSize: 14 },
  restore: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.textPrimary
  },
  restoreBusy: { opacity: 0.5 },
  restoreText: { color: colors.bgBase, fontSize: 15, fontWeight: '600' }
})
