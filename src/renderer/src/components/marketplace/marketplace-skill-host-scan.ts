import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import type { SkillDiscoveryResult } from '../../../../shared/skills'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** A WSL distro's skills, read through the same discovery the Windows desktop app runs for WSL. */
export function discoverSkillsOnWslDistro(distro: string): Promise<SkillDiscoveryResult> {
  return window.api.skills.discover({ runtime: 'wsl', wslDistro: distro })
}

/**
 * The skill scan a Marketplace skill page reads. This computer follows the focused runtime; a picked
 * host reads its own: a runtime server through its environment, a WSL distro through its WSL discovery.
 * Why: an SSH host has no skill discovery path yet, so it reads nothing rather than this computer.
 */
export function discoverSkillsForPickedHost(
  target: MarketplaceVaultHostTarget | null,
  focused: RuntimeClientTarget | null
): Promise<SkillDiscoveryResult> | null {
  if (target === null) {
    return focused === null ? null : discoverSkillsForRuntimeTarget(focused)
  }
  switch (target.kind) {
    case 'runtime':
      return discoverSkillsForRuntimeTarget({
        kind: 'environment',
        environmentId: target.environmentId
      })
    case 'wsl':
      return discoverSkillsOnWslDistro(target.distro)
    case 'ssh':
      return null
  }
}
