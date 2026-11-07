import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/**
 * The runtime a skill removal runs on: this computer's focused runtime, or the picked runtime; null where a
 * removal is not offered. Why: a CLI can call this with the same host target the page reads.
 */
export function skillRemoveTargetFor(
  remote: MarketplaceVaultHostTarget | null,
  focused: RuntimeClientTarget | null
): RuntimeClientTarget | null {
  if (remote === null) {
    return focused
  }
  return remote.kind === 'runtime'
    ? { kind: 'environment', environmentId: remote.environmentId }
    : null
}

/** Why the picked host cannot remove skills yet; null when it can, which is also when no runtime is picked. */
export function skillRemoveUnavailableReason(
  remote: MarketplaceVaultHostTarget | null
): string | null {
  if (remote === null || remote.kind === 'runtime') {
    return null
  }
  if (remote.kind === 'wsl') {
    return translate(
      'auto.components.marketplace.MarketplaceSkillDanger.wslUnavailable',
      'Removing skills on WSL is not available yet.'
    )
  }
  return translate(
    'auto.components.marketplace.MarketplaceSkillDanger.sshUnavailable',
    'Removing skills on SSH hosts is not available yet.'
  )
}
