import { translate } from '@/i18n/i18n'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { CatalogListState } from './MarketplaceCatalogRows'

/** The line a catalog section shows in place of its rows while the list is unknown or empty. */
export function listPlaceholder<T>(list: CatalogListState<T>, host: string): string | null {
  switch (list.kind) {
    case 'loading':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogRows.checkingThisComputer',
        'Checking this computer…'
      )
    case 'unavailable':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogRows.notCheckedOnHost',
        'Not checked on {{host}} yet.',
        { host }
      )
    case 'ready':
      return null
  }
}

export function skillsPlaceholder(
  list: CatalogListState<DiscoveredSkill>,
  host: string
): string | null {
  if (list.kind === 'ready' && list.items.length === 0) {
    return translate(
      'auto.components.marketplace.MarketplaceCatalogRows.noSkills',
      'No skills found on {{host}}.',
      { host }
    )
  }
  return listPlaceholder(list, host)
}
