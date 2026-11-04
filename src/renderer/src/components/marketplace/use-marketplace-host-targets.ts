import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** Hosts that run agents of their own: the active paired server and every connected SSH host. */
export function useMarketplaceHostTargets(): MarketplaceVaultHostTarget[] {
  const environmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const sshStates = useAppStore((s) => s.sshConnectionStates)
  const sshLabels = useAppStore((s) => s.sshTargetLabels)
  return useMemo(() => {
    const targets: MarketplaceVaultHostTarget[] = []
    const trimmed = environmentId?.trim()
    if (trimmed) {
      const name = environments.find((environment) => environment.id === trimmed)?.name
      targets.push({ kind: 'runtime', environmentId: trimmed, label: name || trimmed })
    }
    for (const [connectionId, state] of sshStates) {
      if (state.status === 'connected') {
        targets.push({
          kind: 'ssh',
          connectionId,
          label: sshLabels.get(connectionId) ?? connectionId
        })
      }
    }
    return targets
  }, [environmentId, environments, sshStates, sshLabels])
}

export function marketplaceHostKey(target: MarketplaceVaultHostTarget): string {
  return target.kind === 'ssh' ? `ssh:${target.connectionId}` : `runtime:${target.environmentId}`
}
