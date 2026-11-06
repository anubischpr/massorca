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
        target: null,
        owned: !installing && item.presence === 'found',
        service: false,
        customId: item.id
      }
    })
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
