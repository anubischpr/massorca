import { useEffect } from 'react'
import { Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDetectedAgents, type AgentDetectionTarget } from '@/hooks/useDetectedAgents'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { MarketplaceCardRow, MarketplaceStatusDot } from './MarketplaceDetail'
import {
  marketplaceAgentHostActionLabel,
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostView,
  type MarketplaceAgentDetection,
  type MarketplaceAgentHost
} from './MarketplaceAgentHostState'

/** The picked host's row: its detection, status badge and one action. Reports detection up for the page header. */
export function MarketplaceAgentHostPicked({
  host,
  agentId,
  installUrl,
  onDetection
}: {
  host: MarketplaceAgentHost
  agentId: TuiAgent
  installUrl: string
  onDetection: (key: string, detection: MarketplaceAgentDetection) => void
}): React.JSX.Element {
  // This computer, the paired server and SSH hosts share the renderer's agent detection store.
  const { detectedIds, detectionFailed } = useDetectedAgents(detectionTarget(host))
  const detection: MarketplaceAgentDetection =
    detectedIds !== null
      ? detectedIds.includes(agentId)
        ? 'found'
        : 'missing'
      : detectionFailed
        ? 'unverifiable'
        : 'checking'
  const key = marketplaceAgentHostKey(host)
  useEffect(() => {
    onDetection(key, detection)
  }, [detection, key, onDetection])
  const view = marketplaceAgentHostView(detection)
  // Why: only installing on this computer has a backend today (the agent's own install page).
  const installHere = view.action === 'install' && host.kind === 'local'
  return (
    <div data-marketplace-agent-host={key}>
      <MarketplaceCardRow
        name={marketplaceAgentHostLabel(host)}
        description={view.state}
        leading={<Server className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      >
        {view.badge ? (
          <Badge variant="secondary">
            <MarketplaceStatusDot tone={view.badge.tone} />
            {view.badge.label}
          </Badge>
        ) : null}
        {view.action && installHere ? (
          <Button variant="outline" size="xs" asChild>
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              {marketplaceAgentHostActionLabel(view.action)}
            </a>
          </Button>
        ) : view.action ? (
          <Button type="button" variant="outline" size="xs" disabled>
            {marketplaceAgentHostActionLabel(view.action)}
          </Button>
        ) : null}
      </MarketplaceCardRow>
    </div>
  )
}

function detectionTarget(host: MarketplaceAgentHost): AgentDetectionTarget | null {
  if (host.kind === 'runtime') {
    return { kind: 'runtime', environmentId: host.environmentId }
  }
  if (host.kind === 'ssh') {
    return { kind: 'ssh', connectionId: host.connectionId }
  }
  return null
}
