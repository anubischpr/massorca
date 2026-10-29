import { useContext, useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AlertCircle, Check, CornerDownRight } from 'lucide-react-native'
import type {
  DelegationFinishedPayload,
  DelegationNoticePayload,
  DelegationStartedPayload
} from '../../../src/shared/delegated-session-journal'
import type { DelegatedChild } from '../../../src/shared/delegated-children'
import { useNow } from '../hooks/use-now'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  MobileDelegatedChildContext,
  type MobileDelegatedChildAccess
} from './mobile-delegated-child-access'
import {
  delegatedChildClockText,
  MobileDelegatedChildrenContext
} from './mobile-delegated-child-rows'
import {
  delegationFailedText,
  delegationFinishedHeading,
  delegationFinishedMeta,
  delegationStartDetails,
  delegationStartedText
} from './mobile-delegation-notice-words'

/** A delegated session's start, failure or finish, drawn in the parent chat in place of its plain line. */
export function MobileNativeChatDelegationNotice({
  payload
}: {
  payload: DelegationNoticePayload
}): React.JSX.Element {
  switch (payload.status) {
    case 'started':
      return <StartedNotice payload={payload} />
    case 'failed':
      return (
        <View style={styles.failed}>
          <AlertCircle size={16} color={colors.statusRed} strokeWidth={2} />
          <Text style={styles.failedText}>{delegationFailedText(payload)}</Text>
        </View>
      )
    case 'finished':
      return <FinishedNotice payload={payload} />
  }
}

/** A started child the journal shows still running is a live row; otherwise the plain start line. */
function StartedNotice({ payload }: { payload: DelegationStartedPayload }): React.JSX.Element {
  const { children, hostClockOffsetMs } = useContext(MobileDelegatedChildrenContext)
  const child = children.find((entry) => entry.requestId === payload.requestId)
  if (child?.status === 'working') {
    return <WorkingNotice payload={payload} child={child} hostClockOffsetMs={hostClockOffsetMs} />
  }
  return (
    <View style={styles.started}>
      <CornerDownRight size={13} color={colors.textSecondary} strokeWidth={2} />
      <Text style={styles.startedText}>{delegationStartedText(payload)}</Text>
    </View>
  )
}

function WorkingNotice({
  payload,
  child,
  hostClockOffsetMs
}: {
  payload: DelegationStartedPayload
  child: DelegatedChild
  hostClockOffsetMs: number
}): React.JSX.Element {
  const access = useContext(MobileDelegatedChildContext)
  const now = useNow(60_000)
  useRequestChildRowsOnce(access, payload.childSessionId)
  const clock = delegatedChildClockText(child, now - hostClockOffsetMs)
  const details = `${delegationStartDetails(payload)}${payload.automatic ? ' (Automatic)' : ''}`
  return (
    <View style={styles.finished} accessibilityLabel="Child session working">
      <View style={styles.finishedHead}>
        <View accessibilityRole="image" accessibilityLabel="Working" style={styles.workingDot} />
        <Text style={styles.heading}>Child session working</Text>
      </View>
      <Text style={styles.title}>{payload.title}</Text>
      <Text style={styles.meta}>{clock ? `${details} · ${clock}` : details}</Text>
      {access?.hasChild(payload.childSessionId) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open child chat"
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
          onPress={() => access.openChild(payload.childSessionId)}
        >
          <Text style={styles.openText}>Open child chat</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function FinishedNotice({ payload }: { payload: DelegationFinishedPayload }): React.JSX.Element {
  const access = useContext(MobileDelegatedChildContext)
  const childSessionId = payload.childSessionId
  const succeeded = payload.outcome === 'succeeded'
  const heading = delegationFinishedHeading(payload)
  useRequestChildRowsOnce(access, childSessionId)
  // Why: the control appears only when a real target resolves, a tab here or a pane the host lists, so it never opens nothing.
  const openChild =
    access && childSessionId !== null && access.hasChild(childSessionId)
      ? () => access.openChild(childSessionId)
      : null
  return (
    <View style={styles.finished} accessibilityLabel={heading}>
      <View style={styles.finishedHead}>
        {succeeded ? (
          <Check size={16} color={colors.statusGreen} strokeWidth={2.5} />
        ) : (
          <AlertCircle size={16} color={colors.statusRed} strokeWidth={2} />
        )}
        <Text style={styles.heading}>{heading}</Text>
      </View>
      <Text style={styles.title}>{payload.title}</Text>
      <Text style={[styles.meta, !succeeded && styles.metaFailed]}>
        {delegationFinishedMeta(payload)}
      </Text>
      {payload.resultSummary ? <Text style={styles.summary}>{payload.resultSummary}</Text> : null}
      {openChild ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open child chat"
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
          onPress={openChild}
        >
          <Text style={styles.openText}>Open child chat</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Host rows are read when a notice needs a child this chat does not hold, once per child, not on every mount. */
function useRequestChildRowsOnce(
  access: MobileDelegatedChildAccess | null,
  childSessionId: string | null
): void {
  const requestedChildRef = useRef<string | null>(null)
  useEffect(() => {
    if (!access || childSessionId === null || requestedChildRef.current === childSessionId) {
      return
    }
    if (access.hasChild(childSessionId)) {
      return
    }
    requestedChildRef.current = childSessionId
    access.refreshAgentRows?.()
  }, [access, childSessionId])
}

const styles = StyleSheet.create({
  started: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  startedText: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  failed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  failedText: {
    flex: 1,
    minWidth: 0,
    color: colors.statusRed,
    fontSize: typography.bodySize
  },
  finished: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  finishedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  workingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary
  },
  heading: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  metaFailed: {
    color: colors.statusRed
  },
  summary: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    lineHeight: 20
  },
  open: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  openText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  pressed: {
    opacity: 0.7
  }
})
