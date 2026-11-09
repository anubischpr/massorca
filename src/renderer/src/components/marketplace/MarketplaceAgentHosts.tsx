import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { MarketplaceCard, MarketplaceCardLabel } from './MarketplaceDetail'
import {
  marketplaceAgentHostKey,
  type MarketplaceAgentDetection,
  type MarketplaceAgentHost
} from './MarketplaceAgentHostState'
import { MarketplaceAgentHostPicked } from './MarketplaceAgentHostPicked'

/** The Hosts card for the host picked in the Marketplace host list, and the note under it. */
export function MarketplaceAgentHosts({
  host,
  agentId,
  installUrl,
  installManaged,
  onDetection
}: {
  host: MarketplaceAgentHost
  agentId: TuiAgent
  installUrl: string
  installManaged?: boolean
  onDetection: (key: string, detection: MarketplaceAgentDetection) => void
}): React.JSX.Element {
  return (
    <section data-marketplace-agent-hosts>
      <MarketplaceCardLabel>
        {translate('auto.components.marketplace.MarketplaceAgentPage.hosts', 'Hosts')}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        {/* Why: keyed by host, so a new pick starts from checking, not the previous host's answer. */}
        <MarketplaceAgentHostPicked
          key={marketplaceAgentHostKey(host)}
          host={host}
          agentId={agentId}
          installUrl={installUrl}
          installManaged={installManaged}
          onDetection={onDetection}
        />
      </MarketplaceCard>
      <p className="mt-1.5 text-xs leading-normal text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAgentPage.hostsHelp',
          'Each host has its own agents. MassOrca updates and removes only what it manages. Manage with MassOrca takes over an app installed with a package manager it knows, without reinstalling it. Reinstall with MassOrca appears only when it cannot tell how the app was installed, or the app does not work.'
        )}
      </p>
    </section>
  )
}
