import { parseWslHostFlag, resolveHostFlagTarget } from './execution-host-flag'
import type { RuntimeClient } from './runtime-client'
import type { ManagedSkillInstall, SkillInstallDestination } from '../shared/skill-install-contract'

type GlobalDestination = Extract<SkillInstallDestination, { scope: 'global' }>

export type MarketplaceSkillHost = {
  /** `default`: no --host, so the connected runtime's whole listing, as before. */
  kind: 'default' | 'local' | 'runtime' | 'wsl' | 'ssh'
  label: string
  destination: GlobalDestination
  wslDistro?: string
}

function installTarget(install: ManagedSkillInstall) {
  return install.destination.scope === 'global' ? install.destination.executionTarget : undefined
}

/**
 * Maps `--host` the way the desktop picker does: this computer and a paired runtime install
 * natively on the connected runtime (index.ts already pointed the connection at `runtime:<id>`),
 * a WSL distro and an SSH host ride in the destination's execution target.
 */
export async function resolveMarketplaceSkillHost(
  flags: Map<string, string | boolean>,
  client: RuntimeClient
): Promise<MarketplaceSkillHost> {
  if (!flags.has('host')) {
    return { kind: 'default', label: 'this host', destination: { scope: 'global' } }
  }
  const distro = parseWslHostFlag(flags)
  if (distro !== null) {
    return {
      kind: 'wsl',
      label: `WSL: ${distro}`,
      wslDistro: distro,
      destination: { scope: 'global', executionTarget: { kind: 'wsl', distro } }
    }
  }
  const host = await resolveHostFlagTarget(flags, client)
  switch (host?.kind) {
    case 'ssh':
      return {
        kind: 'ssh',
        label: `SSH: ${host.targetId}`,
        destination: {
          scope: 'global',
          executionTarget: { kind: 'ssh', connectionId: host.targetId }
        }
      }
    case 'runtime':
      return { kind: 'runtime', label: host.id, destination: { scope: 'global' } }
    default:
      return { kind: 'local', label: 'this computer', destination: { scope: 'global' } }
  }
}

/** The global installs that live on the picked host; the connected runtime also lists every distro's and SSH host's. */
export function installsOnMarketplaceHost(
  host: MarketplaceSkillHost,
  installs: readonly ManagedSkillInstall[]
): ManagedSkillInstall[] {
  const global = installs.filter((install) => install.scope === 'global')
  return global.filter((install) => {
    const target = installTarget(install)
    switch (host.kind) {
      case 'default':
      case 'runtime':
        return true
      case 'local':
        return target?.kind !== 'wsl' && target?.kind !== 'ssh'
      case 'wsl':
        return target?.kind === 'wsl' && target.distro === host.wslDistro
      case 'ssh':
        return (
          target?.kind === 'ssh' &&
          host.destination.executionTarget?.kind === 'ssh' &&
          target.connectionId === host.destination.executionTarget.connectionId
        )
    }
  })
}

/** Where an install sits when it is not on the plain host, for the one-line listing. */
export function describeInstallTarget(install: ManagedSkillInstall): string | null {
  const target = installTarget(install)
  if (!target || target.kind === 'host') {
    return null
  }
  return target.kind === 'wsl' ? `WSL ${target.distro}` : `SSH ${target.connectionId}`
}
