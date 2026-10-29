import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { DelegatedChild } from '../../../src/shared/delegated-children'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { BackgroundChildSessions } from './mobile-delegated-child-rows'
import { delegatedChildClockText } from './mobile-delegated-child-rows'
import { agentLabel } from './mobile-delegation-notice-words'

/** The open action for a child, or null where no chat target resolves for it. */
export function backgroundChildOpen(
  child: DelegatedChild,
  sessions: BackgroundChildSessions | undefined
): (() => void) | null {
  const childSessionId = child.childSessionId
  if (sessions === undefined || childSessionId === null || !sessions.canOpen(childSessionId)) {
    return null
  }
  return () => sessions.open(childSessionId)
}

/** A delegated child in the background sheet: its agent, status and clock. The whole row opens it
 *  when a target resolves, where a task row offers Stop. */
export function MobileBackgroundChildRow({
  child,
  hostNow,
  onOpen
}: {
  child: DelegatedChild
  /** `now` on the host's clock, which stamps the child's start. */
  hostNow: number
  onOpen: (() => void) | null
}): React.JSX.Element {
  const clock = delegatedChildClockText(child, hostNow)
  const meta = [
    child.agent === null ? null : agentLabel(child.agent),
    childStatusWord(child),
    clock
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
  const content = (
    <>
      {child.agent === null ? null : <MobileAgentIcon agentId={child.agent} size={18} />}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {child.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {meta}
        </Text>
      </View>
      {onOpen ? <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} /> : null}
    </>
  )
  if (onOpen === null) {
    return (
      <View testID="background-child-row" style={styles.row}>
        {content}
      </View>
    )
  }
  return (
    <Pressable
      testID="background-child-row"
      accessibilityRole="button"
      accessibilityLabel={`Open child chat: ${child.title}`}
      hitSlop={6}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onOpen}
    >
      {content}
    </Pressable>
  )
}

function childStatusWord(child: DelegatedChild): string {
  switch (child.status) {
    case 'working':
      return 'working'
    case 'succeeded':
      return 'succeeded'
    case 'failed':
      return 'failed'
    case 'not-started':
      return 'did not start'
  }
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel
  },
  text: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  pressed: {
    backgroundColor: colors.bgRaised
  }
})
