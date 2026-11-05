import { translate } from '@/i18n/i18n'
import type { MarketplaceActionResult } from '../../../../shared/marketplace-apps'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { vaultHostFailureMessage } from './marketplace-vault-credential-text'

type MarketplaceFailure = Extract<MarketplaceActionResult, { ok: false }>

/** Why a Marketplace change did not complete, in plain words; never the raw error. */
export function marketplaceFailureMessage(failure: MarketplaceFailure, hostLabel?: string): string {
  const host =
    hostLabel ??
    translate(
      'auto.components.marketplace.marketplace-action-messages.thisComputer',
      'this computer'
    )
  const agent = failure.agent ? marketplaceAgentLabel(failure.agent) : null
  switch (failure.reason) {
    case 'invalid-input':
      return translate(
        'auto.components.marketplace.marketplace-action-messages.invalidInput',
        'Check what you entered, then try again.'
      )
    case 'unreadable-config':
      return agent
        ? translate(
            'auto.components.marketplace.marketplace-action-messages.unreadableAgent',
            'The settings file for {{agent}} could not be read.',
            { agent }
          )
        : translate(
            'auto.components.marketplace.marketplace-action-messages.unreadable',
            'A settings file could not be read.'
          )
    case 'unsupported-shape':
      return agent
        ? translate(
            'auto.components.marketplace.marketplace-action-messages.unsupportedAgent',
            'The settings file for {{agent}} has a format MassOrca does not recognize.',
            { agent }
          )
        : translate(
            'auto.components.marketplace.marketplace-action-messages.unsupported',
            'A settings file has a format MassOrca does not recognize.'
          )
    case 'outside-home':
      return agent
        ? translate(
            'auto.components.marketplace.marketplace-action-messages.outsideHomeAgent',
            'The settings file for {{agent}} links outside this home, so MassOrca left it alone.',
            { agent }
          )
        : translate(
            'auto.components.marketplace.marketplace-action-messages.outsideHome',
            'A settings file links outside this home, so MassOrca left it alone.'
          )
    case 'vault-unavailable':
      return hostLabel
        ? translate(
            'auto.components.marketplace.marketplace-action-messages.vaultUnavailableOnHost',
            'The secure vault on {{host}} is not available.',
            { host: hostLabel }
          )
        : translate(
            'auto.components.marketplace.marketplace-action-messages.vaultUnavailable',
            'The secure vault on this computer is not available.'
          )
    case 'host-needs-update':
    case 'unreachable':
      return vaultHostFailureMessage(failure.reason, host)
    case 'failed':
      return changeFailedMessage()
  }
}

/** The change threw before it reported a reason, so the reason is only the generic one. */
export function changeFailedMessage(): string {
  return translate(
    'auto.components.marketplace.marketplace-action-messages.failed',
    'The change did not complete. Try again.'
  )
}

export function marketplaceUnavailableMessage(): string {
  return translate(
    'auto.components.marketplace.marketplace-action-messages.desktopOnly',
    'Available in the desktop app'
  )
}
