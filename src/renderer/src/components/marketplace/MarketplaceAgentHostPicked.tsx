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
import { useWslAgentDetection } from './marketplace-host-wsl'

type PickedRowProps = {
  host: MarketplaceAgentHost
  agentId: TuiAgent
  installUrl: string
  /** MassOrca installs this agent from the page card, so the row shows no Install of its own. */
  installManaged?: boolean
  onDetection: (key: string, detection: MarketplaceAgentDetection) => void
}

/** The picked host's row: its detection, status badge and one action. Reports detection up for the page header. */
export function MarketplaceAgentHostPicked(props: PickedRowProps): React.JSX.Element {
  if (props.host.kind === 'wsl') {
    return <WslHostRow {...props} distro={props.host.distro} />
  }
  return <DetectedHostRow {...props} />
}

/** This computer, the paired server and SSH hosts share the renderer's agent detection store. */
function DetectedHostRow(props: PickedRowProps): React.JSX.Element {
  const { detectedIds, detectionFailed } = useDetectedAgents(detectionTarget(props.host))
  return <HostRow {...props} detection={detectionOf(props.agentId, detectedIds, detectionFailed)} />
}

/** A WSL distro is probed on its own; this computer's detection never answers for it. */
function WslHostRow(props: PickedRowProps & { distro: string }): React.JSX.Element {
  const { detectedIds, detectionFailed } = useWslAgentDetection(props.distro)
  return <HostRow {...props} detection={detectionOf(props.agentId, detectedIds, detectionFailed)} />
}

function detectionOf(
  agentId: TuiAgent,
  detectedIds: readonly string[] | null,
  detectionFailed: boolean
): MarketplaceAgentDetection {
  if (detectedIds !== null) {
    return detectedIds.includes(agentId) ? 'found' : 'missing'
  }
  return detectionFailed ? 'unverifiable' : 'checking'
}

function HostRow({
  host,
  installUrl,
  installManaged = false,
  onDetection,
  detection
}: PickedRowProps & { detection: MarketplaceAgentDetection }): React.JSX.Element {
  const key = marketplaceAgentHostKey(host)
  useEffect(() => {
    onDetection(key, detection)
  }, [detection, key, onDetection])
  const detectionView = marketplaceAgentHostView(detection)
  const view =
    installManaged && detectionView.action === 'install'
      ? { ...detectionView, action: null }
      : detectionView
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
