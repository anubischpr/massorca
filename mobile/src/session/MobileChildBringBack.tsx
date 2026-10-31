import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import {
  childBringBackView,
  interpolateChildBringBackLine
} from '../../../src/shared/child-bring-back'
import {
  ChildBringBackController,
  type ChildBringBackSnapshot
} from '../../../src/shared/child-bring-back-controller'
import { colors, radii, typography } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { mobileChildBringBackCall } from './mobile-child-bring-back-operations'

/** Null where no host connection backs the chat, so a notice offers nothing. */
export const MobileChildBringBackClientContext = createContext<RpcClient | null>(null)

const NO_HOST: ChildBringBackSnapshot = {
  status: { kind: 'unavailable' },
  busy: false,
  error: null
}
const readNoHost = () => NO_HOST
const subscribeToNothing = () => () => undefined

function NoticeButton({
  label,
  primary,
  disabled,
  onPress
}: {
  label: string
  primary?: boolean
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        disabled && styles.disabled,
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <Text style={primary ? styles.primaryText : styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

/** Bring back's part of a finished child notice, in the notice's own shapes. */
export function MobileChildBringBack({
  requestId,
  openChild
}: {
  requestId: string
  /** Open child chat, or null when the child has no chat to open. */
  openChild: (() => void) | null
}): React.JSX.Element {
  const client = useContext(MobileChildBringBackClientContext)
  const controller = useMemo(
    () =>
      client ? new ChildBringBackController(requestId, mobileChildBringBackCall(client)) : null,
    [client, requestId]
  )
  useEffect(() => controller?.start(), [controller])
  const { status, busy, error } = useSyncExternalStore(
    controller?.subscribe ?? subscribeToNothing,
    controller?.getSnapshot ?? readNoHost
  )
  const bringBack = () => controller?.bringBack()
  const abort = () => controller?.abort()
  const resolve = () => controller?.resolve()
  const view = childBringBackView(status)
  const open = view.childOpenable ? openChild : null
  return (
    <>
      {view.meta.length > 0 ? (
        <Text style={styles.meta}>{view.meta.map(interpolateChildBringBackLine).join(' · ')}</Text>
      ) : null}
      {view.warnings.map((line) => (
        <Text key={line.id} style={styles.warning}>
          {interpolateChildBringBackLine(line)}
        </Text>
      ))}
      {view.conflicts ? (
        <>
          <Text style={styles.conflicts}>
            {`Merge conflicts: ${view.conflicts.unresolved} unresolved`}
          </Text>
          {view.conflicts.agentResolving ? null : (
            <NoticeButton label="Resolve with AI" primary disabled={busy} onPress={resolve} />
          )}
          <NoticeButton label="Abort merge" disabled={busy} onPress={abort} />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {view.action ? (
        <NoticeButton
          label={busy ? 'Bringing back…' : 'Bring back'}
          primary
          disabled={busy || !view.action.enabled}
          onPress={bringBack}
        />
      ) : null}
      {open ? <NoticeButton label="Open child chat" onPress={open} /> : null}
    </>
  )
}

const styles = StyleSheet.create({
  meta: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  warning: {
    color: colors.statusAmber,
    fontSize: typography.metaSize
  },
  conflicts: {
    color: colors.statusAmber,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  error: {
    color: colors.statusRed,
    fontSize: typography.metaSize
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  primary: {
    borderWidth: 0,
    backgroundColor: colors.textPrimary
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  primaryText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '500'
  }
})
