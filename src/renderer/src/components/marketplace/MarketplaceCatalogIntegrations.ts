import { translate } from '@/i18n/i18n'
import { integrationGlyph } from './MarketplaceIntegrationIcon'
import type { CatalogRow, CatalogRowStatus } from './MarketplaceCatalogRows'
import {
  connectLabel,
  connectedLabel,
  checkingLabel,
  couldNotCheckLabel
} from './MarketplaceCatalogStatusCopy'
import {
  MARKETPLACE_INTEGRATIONS,
  MARKETPLACE_INTEGRATION_IDS,
  type MarketplaceIntegrationId,
  type MarketplaceIntegrationState,
  type MarketplaceIntegrationStates
} from './marketplace-integrations'

function integrationStatus(state: MarketplaceIntegrationState): CatalogRowStatus {
  switch (state) {
    case 'connected':
      return { kind: 'done', label: connectedLabel() }
    case 'not-connected':
      return { kind: 'action', label: connectLabel() }
    case 'checking':
      return { kind: 'pending', label: checkingLabel() }
    case 'unavailable':
      return { kind: 'pending', label: couldNotCheckLabel() }
  }
}

function integrationRow(
  id: MarketplaceIntegrationId,
  state: MarketplaceIntegrationState
): CatalogRow {
  const info = MARKETPLACE_INTEGRATIONS[id]
  return {
    key: `integration-${id}`,
    section: 'services',
    name: info.name,
    description: translate(info.description.key, info.description.fallback),
    icon: { kind: 'glyph', glyph: integrationGlyph(id) },
    status: integrationStatus(state),
    target: { kind: 'integration', id },
    owned: state === 'connected',
    service: true,
    customId: null
  }
}

/** The Settings integrations as real Services rows, each with the status its own check reports. */
export function integrationRows(states: MarketplaceIntegrationStates): CatalogRow[] {
  return MARKETPLACE_INTEGRATION_IDS.map((id) => integrationRow(id, states[id]))
}
