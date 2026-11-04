import { useEffect, useMemo } from 'react'
import { Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useDetectedAgents, type AgentDetectionTarget } from '@/hooks/useDetectedAgents'
import { useLocalWindowsTerminalCapabilities } from '@/lib/windows-terminal-capabilities'
import { isWebClientLocation } from '@/lib/web-client-location'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useSkillInstallDetectedAgents } from '../skills/use-skill-install-detected-agents'
import {
  MarketplaceCard,
  MarketplaceCardLabel,
  MarketplaceCardRow,
  MarketplaceStatusDot
} from './MarketplaceDetail'
import {
  marketplaceAgentHostActionLabel,
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostView,
  type MarketplaceAgentDetection,
  type MarketplaceAgentHost
} from './MarketplaceAgentHostState'
import { useMarketplaceHostTargets } from './use-marketplace-host-targets'

/** This computer, the paired server, each WSL distro (Windows desktop only) and each connected SSH host. */
export function useMarketplaceAgentHosts(): MarketplaceAgentHost[] {
  const targets = useMarketplaceHostTargets()
  const isWindowsDesktop =
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('Windows') &&
    !isWebClientLocation()
  const { wslDistros } = useLocalWindowsTerminalCapabilities(isWindowsDesktop)
  return useMemo(() => {
    const hosts: MarketplaceAgentHost[] = [{ kind: 'local' }]
    for (const target of targets) {
      if (target.kind === 'runtime') {
        hosts.push({ kind: 'runtime', environmentId: target.environmentId, label: target.label })
      }
    }
    if (isWindowsDesktop) {
      for (const distro of wslDistros) {
        hosts.push({ kind: 'wsl', distro })
      }
    }
    for (const target of targets) {
      if (target.kind === 'ssh') {
        hosts.push({ kind: 'ssh', connectionId: target.connectionId, label: target.label })
      }
    }
    return hosts
  }, [isWindowsDesktop, targets, wslDistros])
}

type HostRowProps = {
  host: MarketplaceAgentHost
  agentId: TuiAgent
  installUrl: string
  onDetection: (key: string, detection: MarketplaceAgentDetection) => void
}

/** The Hosts card and the note under it; each row reports its detection so the header can count hosts. */
export function MarketplaceAgentHosts({
  hosts,
  agentId,
  installUrl,
  onDetection
}: {
  hosts: readonly MarketplaceAgentHost[]
  agentId: TuiAgent
  installUrl: string
  onDetection: (key: string, detection: MarketplaceAgentDetection) => void
}): React.JSX.Element {
  return (
    <section data-marketplace-agent-hosts>
      <MarketplaceCardLabel>
        {translate('auto.components.marketplace.MarketplaceAgentPage.hosts', 'Hosts')}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        {hosts.map((host) => {
          const props: HostRowProps = { host, agentId, installUrl, onDetection }
          const key = marketplaceAgentHostKey(host)
          return host.kind === 'wsl' ? (
            <WslHostRow key={key} {...props} distro={host.distro} />
          ) : (
            <DetectedHostRow key={key} {...props} />
          )
        })}
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

function detectionTarget(host: MarketplaceAgentHost): AgentDetectionTarget | null {
  if (host.kind === 'runtime') {
    return { kind: 'runtime', environmentId: host.environmentId }
  }
  if (host.kind === 'ssh') {
    return { kind: 'ssh', connectionId: host.connectionId }
  }
  return null
}

/** This computer, the paired server and SSH hosts share the renderer's agent detection store. */
function DetectedHostRow(props: HostRowProps): React.JSX.Element {
  const { detectedIds, detectionFailed } = useDetectedAgents(detectionTarget(props.host))
  const detection: MarketplaceAgentDetection =
    detectedIds !== null
      ? detectedIds.includes(props.agentId)
        ? 'found'
        : 'missing'
      : detectionFailed
        ? 'unverifiable'
        : 'checking'
  return <HostRow {...props} detection={detection} />
}

/** WSL distros are probed on demand; the store keeps no per-distro list. */
function WslHostRow(props: HostRowProps & { distro: string }): React.JSX.Element {
  const detected = useSkillInstallDetectedAgents({
    environmentId: 'local',
    wslDistro: props.distro
  })
  const detection: MarketplaceAgentDetection =
    detected === null ? 'checking' : detected.includes(props.agentId) ? 'found' : 'missing'
  return <HostRow {...props} detection={detection} />
}

function HostRow({
  host,
  installUrl,
  onDetection,
  detection
}: HostRowProps & { detection: MarketplaceAgentDetection }): React.JSX.Element {
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
