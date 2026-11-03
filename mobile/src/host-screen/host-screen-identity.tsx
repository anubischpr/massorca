import { Pressable, Text, View } from 'react-native'
import { StatusDot } from '../components/StatusDot'
import { classifyConnection, type ConnectionVerdict } from '../transport/connection-health'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

function isErrorVerdict(verdict: ConnectionVerdict): boolean {
  return (
    verdict.kind === 'warning' || verdict.kind === 'unreachable' || verdict.kind === 'auth-failed'
  )
}

function connectionVerdict(controller: HostScreenController): ConnectionVerdict {
  return classifyConnection({
    state: controller.connState,
    reconnectAttempts: controller.reconnectAttempts,
    lastConnectedAt: controller.lastConnectedAt,
    hostName: controller.state.hostName,
    ...controller.relayRecovery
  })
}

/** The status dot, host name and platform line that name the host in either header. */
export function HostIdentity({ controller }: { controller: HostScreenController }) {
  const { connState, hostDisplay } = controller
  return (
    <View style={styles.hostIdentity}>
      <View style={styles.hostIdentityLine}>
        <StatusDot state={connState} verdict={connectionVerdict(controller)} />
        <Text style={styles.hostNameText} numberOfLines={1}>
          {hostDisplay.title}
        </Text>
      </View>
      {hostDisplay.descriptorLine ? (
        <Text style={styles.hostPlatformText} numberOfLines={1}>
          {hostDisplay.descriptorLine}
        </Text>
      ) : null}
    </View>
  )
}

/** Reconnect for an error verdict on a native host; on the page, nothing here re-dials. */
export function HostReconnectButton({ controller }: { controller: HostScreenController }) {
  const { connState, forceReconnectHost, hostId } = controller
  const verdict = connectionVerdict(controller)
  // Why: auth-failed has its own banner, so suppress the Reconnect button for that verdict.
  if (
    connState === 'connected' ||
    !isErrorVerdict(verdict) ||
    !hostId ||
    verdict.kind === 'auth-failed' ||
    forceReconnectHost === null
  ) {
    return null
  }
  return (
    <Pressable
      style={styles.reconnectButton}
      onPress={() => void forceReconnectHost(hostId)}
      accessibilityRole="button"
      accessibilityLabel="Reconnect"
      hitSlop={8}
    >
      <Text style={styles.reconnectButtonText}>Reconnect</Text>
    </Pressable>
  )
}
