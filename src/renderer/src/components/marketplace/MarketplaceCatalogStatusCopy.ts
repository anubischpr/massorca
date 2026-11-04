import { translate } from '@/i18n/i18n'

/** The words a catalog row shows as its status or action, translated where they are drawn. */

export function installedLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.installed', 'Installed')
}

export function foundLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.found', 'Found')
}

export function installLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.install', 'Install')
}

export function connectLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.connect', 'Connect')
}

export function connectedLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.connected', 'Connected')
}

export function checkingLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.checking', 'Checking…')
}

export function couldNotCheckLabel(): string {
  return translate(
    'auto.components.marketplace.MarketplaceCatalogRows.couldNotCheck',
    'Could not check'
  )
}

export function desktopOnlyLabel(): string {
  return translate(
    'auto.components.marketplace.MarketplaceCatalogRows.desktopOnly',
    'Available in the desktop app'
  )
}

export function installingLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.installing', 'Installing…')
}
