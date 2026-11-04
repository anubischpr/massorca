import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, spacing } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import {
  restoreFailureAlert,
  restoreMobilePrototypeVersionOf
} from './mobile-prototype-version-restore'
import { restoreLabelOf } from './mobile-prototype-versions-model'

/** The bottom bar of an earlier version: Restore as the next version, after the user confirms. */
export function MobilePrototypeRestoreBar({
  client,
  set,
  letter,
  version,
  latestVersion,
  onRestored,
  onUnsupported
}: {
  client: RpcClient
  set: PrototypeListedSet
  letter: string
  version: number
  latestVersion: number
  onRestored: () => void
  onUnsupported: () => void
}) {
  const [restoring, setRestoring] = useState(false)
  const restore = async (): Promise<void> => {
    setRestoring(true)
    const outcome = await restoreMobilePrototypeVersionOf(client, set, letter, version)
    setRestoring(false)
    if (outcome.kind === 'restored') {
      onRestored()
      return
    }
    if (outcome.kind === 'unsupported-host') {
      onUnsupported()
    }
    const failure = restoreFailureAlert(outcome)
    if (failure !== null) {
      Alert.alert(failure.title, failure.message)
    }
  }
  // Why: a restore is a new current version, so it asks first; nothing is removed.
  const confirm = (): void => {
    Alert.alert(
      `Restore v${version} as v${latestVersion + 1}?`,
      `v${version} becomes the current version of ${letter}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => void restore() }
      ]
    )
  }
  return (
    <View style={styles.bar}>
      <Text style={styles.note}>Asks to confirm first. No version is deleted.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: restoring }}
        disabled={restoring}
        onPress={confirm}
        style={[styles.button, restoring && styles.buttonBusy]}
      >
        <Text style={styles.buttonText}>{restoreLabelOf(latestVersion)}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  note: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.textPrimary
  },
  buttonBusy: { opacity: 0.5 },
  buttonText: { color: colors.bgBase, fontSize: 15, fontWeight: '600' }
})
