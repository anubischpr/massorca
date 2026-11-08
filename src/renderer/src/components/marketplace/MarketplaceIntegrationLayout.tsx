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

/** The shared page body: header, banner, Connection, Advanced options and Danger zone, each with its content or a why line. */
export function MarketplaceIntegrationLayout({
  id,
  state,
  headerAction,
  connectionAction,
  connection,
  advanced,
  disconnects,
  dangerNote
}: {
  id: MarketplaceIntegrationId
  state: MarketplaceIntegrationState
  headerAction?: React.ReactNode
  connectionAction?: React.ReactNode
  connection: React.ReactNode
  advanced: React.ReactNode
  disconnects: readonly IntegrationDisconnect[]
  /** Why the Danger zone has nothing to disconnect right now; shown only when there is nothing to list. */
  dangerNote: string
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
      <MarketplaceIntegrationAdvanced>{advanced}</MarketplaceIntegrationAdvanced>
      <MarketplaceIntegrationDanger items={disconnects} emptyNote={dangerNote} />
    </>
  )
}
