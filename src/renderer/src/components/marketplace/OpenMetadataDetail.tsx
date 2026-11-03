import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_MCP_AGENTS,
  type MarketplaceDetection
} from '../../../../shared/marketplace-types'
import { MARKETPLACE_AGENT_LABELS } from './marketplace-catalog'
import { mcpEntryBadgeState } from './marketplace-status'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'

// Why: listed so the gap is visible; these agents have no MCP config MassOrca reads yet.
const UNSUPPORTED_AGENT_NAMES = ['Antigravity', 'Gentle Shell'] as const

export function OpenMetadataDetail({
  detection
}: {
  detection: MarketplaceDetection
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {translate(
              'auto.components.marketplace.OpenMetadataDetail.agents',
              'Agents on this computer'
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            {MARKETPLACE_MCP_AGENTS.map((agent) => {
              const { reader, writer } = detection.openMetadata.agents[agent]
              return (
                <div key={agent} className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{MARKETPLACE_AGENT_LABELS[agent]}</p>
                  <MarketplaceInfoRow
                    label={translate(
                      'auto.components.marketplace.OpenMetadataDetail.readAccess',
                      'Read access (openmetadata)'
                    )}
                  >
                    <MarketplaceStatusBadge state={mcpEntryBadgeState(reader)} />
                  </MarketplaceInfoRow>
                  <MarketplaceInfoRow
                    label={translate(
                      'auto.components.marketplace.OpenMetadataDetail.writeAccess',
                      'Write access (openmetadata-escritura)'
                    )}
                  >
                    <MarketplaceStatusBadge state={mcpEntryBadgeState(writer)} />
                  </MarketplaceInfoRow>
                </div>
              )
            })}
            {UNSUPPORTED_AGENT_NAMES.map((name) => (
              <MarketplaceInfoRow key={name} label={name}>
                <MarketplaceStatusBadge state="not-supported" />
              </MarketplaceInfoRow>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.OpenMetadataDetail.comingSoon',
          'Connecting from MassOrca is coming soon. Today the entries are added by hand.'
        )}
      </p>
    </div>
  )
}
