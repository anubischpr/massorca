import { translate } from '@/i18n/i18n'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplaceIntegrationBanner } from './MarketplaceIntegrationBanner'
import {
  MarketplaceIntegrationDanger,
  type IntegrationDisconnect
} from './MarketplaceIntegrationDanger'
import { MarketplaceIntegrationHeader } from './MarketplaceIntegrationHeader'
import type {
  MarketplaceIntegrationId,
  MarketplaceIntegrationState
} from './marketplace-integrations'

/** The shared page body: header, banner, Connection, then Advanced options and Danger zone when the integration has them. */
export function MarketplaceIntegrationLayout({
  id,
  state,
  headerAction,
  connectionAction,
  connection,
  advanced,
  disconnects
}: {
  id: MarketplaceIntegrationId
  state: MarketplaceIntegrationState
  headerAction?: React.ReactNode
  connectionAction?: React.ReactNode
  connection: React.ReactNode
  advanced?: React.ReactNode
  disconnects: readonly IntegrationDisconnect[]
}): React.JSX.Element {
  return (
    <>
      <MarketplaceIntegrationHeader id={id} state={state} action={headerAction} />
      <MarketplaceIntegrationBanner id={id} />
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
        action={connectionAction}
      >
        {connection}
      </MarketplaceAppSection>
      {advanced ? (
        <MarketplaceIntegrationAdvanced>{advanced}</MarketplaceIntegrationAdvanced>
      ) : null}
      <MarketplaceIntegrationDanger items={disconnects} />
    </>
  )
}
