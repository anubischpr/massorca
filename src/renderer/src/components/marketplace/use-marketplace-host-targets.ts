import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { pickerExecutionHosts } from '../../../../shared/managed-orcad-execution-host'
import { buildSidebarHostOptions, type SidebarHostOption } from '../sidebar/sidebar-host-options'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/**
 * The reachable remote hosts among Workspaces' own host list: every paired server it knows, not only
 * the active one, and every connected SSH host. A host that needs an update stays listed so its
 * actions can say so.
 */
export function marketplaceHostTargetsFrom(
  hosts: readonly SidebarHostOption[]
): MarketplaceVaultHostTarget[] {
  return pickerExecutionHosts(hosts).flatMap((host): MarketplaceVaultHostTarget[] => {
    const parsed = parseExecutionHostId(host.id)
    // Why: a paired server still verifying its link is listed; its actions report what they find.
    if (
      parsed?.kind === 'runtime' &&
      (host.health === 'available' || host.health === 'blocked' || host.health === 'connecting')
    ) {
      return [{ kind: 'runtime', environmentId: parsed.environmentId, label: host.label }]
    }
    if (parsed?.kind === 'ssh' && host.health === 'available') {
      return [{ kind: 'ssh', connectionId: parsed.targetId, label: host.label }]
    }
    return []
  })
}

/** Hosts that run agents of their own, from the same registry the Workspaces sidebar reads. */
export function useMarketplaceHostTargets(): MarketplaceVaultHostTarget[] {
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  return useMemo(
    () =>
      marketplaceHostTargetsFrom(
        buildSidebarHostOptions({
          repos,
          sshTargetLabels,
          sshConnectionStates,
          settings,
          runtimeEnvironments,
          runtimeStatusByEnvironmentId,
          hostLabelOverrides: getHostDisplayLabelOverrides(settings)
        })
      ),
    [
      repos,
      settings,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId,
      sshConnectionStates,
      sshTargetLabels
    ]
  )
}

export function marketplaceHostKey(target: MarketplaceVaultHostTarget): string {
  return target.kind === 'ssh' ? `ssh:${target.connectionId}` : `runtime:${target.environmentId}`
}
