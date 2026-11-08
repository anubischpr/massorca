import { translate } from '@/i18n/i18n'

/** The words a catalog row shows as its status or action, translated where they are drawn. */

export function installedLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.installed', 'Installed')
}

/** Reuses the composer's existing Built-in skill scope label. */
export function builtInLabel(): string {
  return translate('components.native-chat.composer.skillScopeBuiltIn', 'Built-in')
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

/** The host's check found the tool missing; the row's control stays disabled because MassOrca has no install for it. */
export function notInstalledLabel(): string {
  return translate(
    'auto.components.marketplace.MarketplaceCatalogRows.notInstalled',
    'Not installed'
  )
}

/** MassOrca has no check for this row yet, so it claims no install state. */
export function notCheckedLabel(): string {
  return translate('auto.components.marketplace.MarketplaceCatalogRows.notChecked', 'Not checked')
}

/** The host has no path for this check yet, so the row cannot say whether the item is there. */
export function notAvailableOnLabel(host: string): string {
  return translate(
    'auto.components.marketplace.MarketplaceCatalogRows.notAvailableOn',
    'Not available on {{host}} yet',
    { host }
  )
}

/** A host too old to answer a check: the row asks for the update that lets the check run. */
export function updateOnHostLabel(host: string): string {
  return translate(
    'auto.components.marketplace.MarketplaceCatalogRows.updateOnHost',
    'Update MassOrca on {{host}}',
    { host }
  )
}
