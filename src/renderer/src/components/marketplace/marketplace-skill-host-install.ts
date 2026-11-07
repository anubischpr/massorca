import type { SkillInstallInitialTarget } from '../skills/skill-install-dialog-initial-target'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { SkillPackageVersionInstallInput } from '../../../../shared/skill-sharing-contract'
import type { SkillInstallProviderId } from '../../../../shared/skill-install-providers'
import { wslInstallsOf } from './marketplace-managed-skills'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** Where the install dialog opens for a picked host: this computer, a runtime, an SSH host, or a WSL distro. */
export function skillInstallTargetFor(
  target: MarketplaceVaultHostTarget | null,
  providers: readonly SkillInstallProviderId[]
): SkillInstallInitialTarget {
  switch (target?.kind) {
    case undefined:
      return { environmentId: 'local', providers }
    case 'runtime':
      return { environmentId: target.environmentId, providers }
    case 'ssh':
      return { environmentId: `ssh:${target.connectionId}`, providers }
    case 'wsl':
      return {
        environmentId: 'local',
        executionTarget: { kind: 'wsl', distro: target.distro },
        providers
      }
  }
}

/** The environment id whose managed installs are listed; WSL and this computer share the local listing. */
export function managedListingEnvironmentId(
  target: MarketplaceVaultHostTarget | null
): string | undefined {
  switch (target?.kind) {
    case 'runtime':
      return target.environmentId
    case 'ssh':
      return `ssh:${target.connectionId}`
    default:
      return undefined
  }
}

/** The installs that live on the host: the local listing also carries every WSL distro's installs. */
export function installsOnHost(
  target: MarketplaceVaultHostTarget | null,
  installs: readonly ManagedSkillInstall[]
): ManagedSkillInstall[] {
  if (target?.kind === 'wsl') {
    return wslInstallsOf(installs, target.distro)
  }
  if (target?.kind === 'runtime' || target?.kind === 'ssh') {
    return [...installs]
  }
  return installs.filter((install) => {
    const kind =
      install.destination.scope === 'global' ? install.destination.executionTarget?.kind : undefined
    return kind !== 'wsl' && kind !== 'ssh'
  })
}

/** The global install of one skill folder; a workspace copy is not what the host-level switches change. */
export function managedInstallForFolder(
  installs: readonly ManagedSkillInstall[],
  folder: string
): ManagedSkillInstall | undefined {
  return installs.find((install) => install.scope === 'global' && install.name === folder)
}

/**
 * The existing placement request that makes an installed copy read for exactly these agents on its host.
 * Why: installing the same package with a provider list reconciles that host's placements to the list.
 */
export function agentSwitchInstallRequest(
  target: MarketplaceVaultHostTarget | null,
  install: ManagedSkillInstall,
  providers: readonly SkillInstallProviderId[]
): SkillPackageVersionInstallInput {
  const base = {
    packageId: install.packageId,
    versionId: install.versionId,
    providers: [...providers]
  }
  switch (target?.kind) {
    case undefined:
      return { ...base, destination: { scope: 'global' } }
    case 'runtime':
      return { ...base, environmentId: target.environmentId, destination: { scope: 'global' } }
    case 'ssh':
      return {
        ...base,
        destination: {
          scope: 'global',
          executionTarget: { kind: 'ssh', connectionId: target.connectionId }
        }
      }
    case 'wsl':
      return {
        ...base,
        destination: { scope: 'global', executionTarget: { kind: 'wsl', distro: target.distro } }
      }
  }
}
