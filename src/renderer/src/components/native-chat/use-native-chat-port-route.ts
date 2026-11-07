import { useAppStore } from '@/store'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { browserUrlForPortForwardEntry } from '@/lib/workspace-port-urls'
import { getRuntimeSshAccess } from '../../../../shared/runtime-environments'

const LOOPBACK_FORWARD_HOSTS = ['localhost', '127.0.0.1', '::1']

/** How this PC reaches a loopback port on the chat's execution host: directly when local, through a
 *  live SSH forward of that port when remote, otherwise not at all (null). */
export function useNativeChatPortRoute(target: RuntimeClientTarget) {
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  const environment = useAppStore((state) =>
    environmentId
      ? state.runtimeEnvironments.find((entry) => entry.id === environmentId)
      : undefined
  )
  const access = environment ? getRuntimeSshAccess(environment) : undefined
  const targetGeneration = useAppStore((state) =>
    access ? state.sshTargetGenerations.get(access.sshTargetId) : undefined
  )
  const connection = useAppStore((state) =>
    access ? state.sshConnectionStates.get(access.sshTargetId) : undefined
  )
  const forwards = useAppStore((state) =>
    access ? state.portForwardsByConnection[access.sshTargetId] : undefined
  )
  const canForward =
    access !== undefined &&
    targetGeneration === access.sshTargetGeneration &&
    connection?.status === 'connected'
  /** The client URL of a remote loopback port's forward, or null when none is live. */
  const forwardedUrl = (port: number, https: boolean): string | null => {
    const forward = canForward
      ? forwards?.find(
          (entry) => entry.remotePort === port && LOOPBACK_FORWARD_HOSTS.includes(entry.remoteHost)
        )
      : undefined
    return forward
      ? browserUrlForPortForwardEntry({ ...forward, advertisedProtocol: https ? 'https' : 'http' })
      : null
  }
  return { local: target.kind === 'local', access, canForward, forwardedUrl }
}

/** The URL this PC opens for an environment URL: itself unless it is a remote loopback URL, which
 *  goes through its port's forward (path kept) or, with no forward, has no route (null). */
export function clientRouteForEnvironmentUrl(
  url: string,
  loopback: boolean,
  route: Pick<ReturnType<typeof useNativeChatPortRoute>, 'local' | 'forwardedUrl'>
): string | null {
  if (route.local || !loopback) {
    return url
  }
  const parsed = new URL(url)
  const https = parsed.protocol === 'https:'
  const base = route.forwardedUrl(Number(parsed.port || (https ? 443 : 80)), https)
  return base ? new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, base).toString() : null
}
