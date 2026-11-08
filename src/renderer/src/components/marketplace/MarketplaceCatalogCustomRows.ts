import { translate } from '@/i18n/i18n'
import type { MarketplaceCustomItemStatus } from '../../../../shared/marketplace-custom'
import type {
  CatalogBuildInputs,
  CatalogRow,
  CatalogRowStatus,
  MarketplaceCatalogSectionId
} from './MarketplaceCatalogRows'
import {
  couldNotCheckLabel,
  installLabel,
  installedLabel,
  installingLabel
} from './MarketplaceCatalogStatusCopy'

/** The custom items of one kind, as rows of the section they were added to. */
export function customRows(
  inputs: CatalogBuildInputs,
  itemKind: MarketplaceCustomItemStatus['kind'],
  section: MarketplaceCatalogSectionId
): CatalogRow[] {
  if (inputs.custom.kind === 'unavailable') {
    return [unavailableCustomRow(inputs.hostLabel, itemKind, section)]
  }
  if (inputs.custom.kind !== 'ready') {
    return []
  }
  return inputs.custom.items
    .filter((item) => item.kind === itemKind)
    .map((item): CatalogRow => {
      const installing = inputs.installingCustomIds.has(item.id)
      return {
        key: `custom-${item.id}`,
        section,
        name: item.name,
        description: item.checkCommand?.join(' ') ?? '',
        icon: { kind: 'custom', itemKind: item.kind },
        status: customStatus(item.presence, installing),
        target:
          itemKind === 'skill' ? { kind: 'custom-skill', item } : { kind: 'custom-item', item },
        owned: !installing && item.presence === 'found',
        service: false,
        customId: item.id
      }
    })
}

/** A picked host has no custom check of its own yet, so its custom row says so instead of listing this computer's. */
function unavailableCustomRow(
  host: string,
  itemKind: MarketplaceCustomItemStatus['kind'],
  section: MarketplaceCatalogSectionId
): CatalogRow {
  return {
    key: `custom-unavailable-${section}`,
    section,
    name: unavailableCustomName(itemKind),
    description: '',
    icon: { kind: 'custom', itemKind },
    status: {
      kind: 'pending',
      label: translate(
        'auto.components.marketplace.MarketplaceCatalogCustomRows.notAvailableOn',
        'Not available on {{host}} yet',
        { host }
      )
    },
    target: { kind: 'custom-unavailable', itemKind },
    owned: false,
    service: false,
    customId: null
  }
}

function unavailableCustomName(itemKind: MarketplaceCustomItemStatus['kind']): string {
  switch (itemKind) {
    case 'agent':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogCustomRows.customAgents',
        'Custom agents'
      )
    case 'skill':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogCustomRows.customSkills',
        'Custom skills'
      )
    case 'tool':
      return translate(
        'auto.components.marketplace.MarketplaceCatalogCustomRows.customTools',
        'Custom tools'
      )
  }
}

function customStatus(
  presence: MarketplaceCustomItemStatus['presence'],
  installing: boolean
): CatalogRowStatus {
  if (installing) {
    return { kind: 'pending', label: installingLabel() }
  }
  switch (presence) {
    case 'found':
      return { kind: 'done', label: installedLabel() }
    case 'missing':
      return { kind: 'action', label: installLabel() }
    case 'unverifiable':
      return { kind: 'pending', label: couldNotCheckLabel() }
  }
}
