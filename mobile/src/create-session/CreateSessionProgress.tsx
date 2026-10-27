import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { CreateSessionStep } from './create-session-launch-plan'

/**
 * The first message and the steps the host takes before the chat opens. The host answers once the
 * whole launch is done, so the first step reads as running and the rest as waiting; nothing here
 * claims a step finished that the phone cannot see.
 */
export function CreateSessionProgress({
  prompt,
  steps
}: {
  prompt: string
  steps: readonly CreateSessionStep[]
}): React.JSX.Element {
  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{prompt}</Text>
      </View>
      <View style={styles.card}>
        {steps.map((step, index) => {
          const active = index === 0
          return (
            <View key={step.id} style={styles.step}>
              {active ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <View style={styles.pending} />
              )}
              <Text style={[styles.stepLabel, !active && styles.stepWaiting]}>{step.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: colors.bgRaised,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11
  },
  bubbleText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  card: {
    gap: spacing.md,
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 22 },
  pending: {
    width: 8,
    height: 8,
    margin: 6,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle
  },
  stepLabel: { color: colors.textPrimary, fontSize: typography.bodySize },
  stepWaiting: { color: colors.textMuted }
})
