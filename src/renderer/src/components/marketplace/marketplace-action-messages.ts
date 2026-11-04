import { translate } from '@/i18n/i18n'
import type { MarketplaceActionResult } from '../../../../shared/marketplace-apps'
import { marketplaceAgentLabel } from './marketplace-catalog'

type MarketplaceFailure = Extract<MarketplaceActionResult, { ok: false }>

/** Why a Marketplace change did not complete, in plain words; never the raw error. */
export function marketplaceFailureMessage(failure: MarketplaceFailure): string {
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
    case 'vault-unavailable':
      return translate(
        'auto.components.marketplace.marketplace-action-messages.vaultUnavailable',
        'The secure vault on this computer is not available.'
      )
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
