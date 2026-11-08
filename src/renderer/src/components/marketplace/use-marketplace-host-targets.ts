import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { pickerExecutionHosts } from '../../../../shared/managed-orcad-execution-host'
import { buildSidebarHostOptions, type SidebarHostOption } from '../sidebar/sidebar-host-options'
import { useMarketplaceWslTargets } from './marketplace-host-wsl'
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

/**
 * The host picker's list, built from the registry the Workspaces sidebar reads, then the WSL distros.
 * Why: the audit reads this same list without hooks, so a host it names is one the picker offers.
 */
export function marketplaceHostTargetsOf(
  registry: Parameters<typeof buildSidebarHostOptions>[0],
  wslTargets: readonly MarketplaceVaultHostTarget[]
): MarketplaceVaultHostTarget[] {
  return [...marketplaceHostTargetsFrom(buildSidebarHostOptions(registry)), ...wslTargets]
}

/**
 * Hosts that run agents of their own, from the same registry the Workspaces sidebar reads, then the
 * WSL distros of the Windows desktop app.
 */
export function useMarketplaceHostTargets(): MarketplaceVaultHostTarget[] {
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  const runtimeEnvironments = useAppStore((s) => s.runtimeEnvironments)
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const wslTargets = useMarketplaceWslTargets()
  return useMemo(
    () =>
      marketplaceHostTargetsOf(
        {
          repos,
          settings,
          runtimeEnvironments,
          runtimeStatusByEnvironmentId,
          sshConnectionStates,
          sshTargetLabels,
          hostLabelOverrides: getHostDisplayLabelOverrides(settings)
        },
        wslTargets
      ),
    [
      repos,
      settings,
      runtimeEnvironments,
      runtimeStatusByEnvironmentId,
      sshConnectionStates,
      sshTargetLabels,
      wslTargets
    ]
  )
}

export function marketplaceHostKey(target: MarketplaceVaultHostTarget): string {
  switch (target.kind) {
    case 'ssh':
      return `ssh:${target.connectionId}`
    case 'runtime':
      return `runtime:${target.environmentId}`
    case 'wsl':
      return `wsl:${target.distro}`
  }
}
