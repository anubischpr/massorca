import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { AgentIcon, getAgentCatalog, getAgentDisplayLabel } from '@/lib/agent-catalog'
import { GentleShellIcon } from '@/lib/agent-icon-gentle-shell'
import { cn } from '@/lib/utils'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { buildAgentCatalogRowProps } from '../settings/agent-settings-row-props'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAgentHosts } from './MarketplaceAgentHosts'
import {
  marketplaceAgentHostFromTarget,
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostStatus,
  type MarketplaceAgentDetection
} from './MarketplaceAgentHostState'
import { MarketplaceAgentSettings } from './MarketplaceAgentSettings'
import { MarketplaceBreadcrumb, MarketplaceItemHeader } from './MarketplaceDetail'
import { MarketplaceHomeHostPicker } from './MarketplaceHomeHostPicker'
import { useMarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'

// Why: the agent catalog carries no description; only agents whose maker is certain get one.
const AGENT_DESCRIPTIONS: Partial<Record<TuiAgent, { key: string; fallback: string }>> = {
  claude: {
    key: 'auto.components.marketplace.MarketplaceAgentPage.description.claude',
    fallback: 'Coding agent from Anthropic.'
  },
  codex: {
    key: 'auto.components.marketplace.MarketplaceAgentPage.description.codex',
    fallback: 'Coding agent from OpenAI.'
  },
  gemini: {
    key: 'auto.components.marketplace.MarketplaceAgentPage.description.gemini',
    fallback: 'Coding agent from Google.'
  }
}

/** An agent on the host picked in the Marketplace host list, then its settings on this computer. */
export function MarketplaceAgentPage({
  agentId,
  onBack
}: {
  agentId: TuiAgent
  onBack: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const piRuntime = usePiDisplayRuntime()
  const { detectedIds } = useDetectedAgents(null)
  const host = useMarketplaceAppHost()
  const pickedTarget =
    host.targets.find((target) => marketplaceHostKey(target) === host.selectedKey) ?? null
  const pickedHost = marketplaceAgentHostFromTarget(pickedTarget)
  const [detections, setDetections] = useState<Record<string, MarketplaceAgentDetection>>({})
  const reportDetection = useCallback((key: string, detection: MarketplaceAgentDetection) => {
    setDetections((current) =>
      current[key] === detection ? current : { ...current, [key]: detection }
    )
  }, [])
  const entry = getAgentCatalog().find((agent) => agent.id === agentId)
  // Why: in the Marketplace the Pi entry is Gentle Shell, never called Pi and always with its rose.
  const gentleShell = agentId === 'pi'
  const name = gentleShell ? 'Gentle Shell' : getAgentDisplayLabel(agentId, piRuntime)
  const description = AGENT_DESCRIPTIONS[agentId]
  const status = marketplaceAgentHostStatus(
    pickedTarget?.label ?? marketplaceAgentHostLabel({ kind: 'local' }),
    detections[marketplaceAgentHostKey(pickedHost)] ?? 'checking'
  )
  const isFoundHere = detectedIds?.includes(agentId) ?? false
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MarketplaceBreadcrumb name={name} onBack={onBack} />
        {/* Why: same host list as the Marketplace home and app pages. */}
        {host.targets.length === 0 ? null : <MarketplaceHomeHostPicker host={host} />}
      </div>
      <MarketplaceItemHeader
        icon={gentleShell ? <GentleShellIcon size={30} /> : <AgentIcon agent={agentId} size={30} />}
        name={name}
        description={description ? translate(description.key, description.fallback) : null}
        statusTone={status.tone}
        status={status.text}
      />
      <MarketplaceAgentHosts
        host={pickedHost}
        agentId={agentId}
        installUrl={entry?.homepageUrl ?? ''}
        onDetection={reportDetection}
      />
      {entry && settings ? (
        <MarketplaceAgentSettings
          hostName={marketplaceAgentHostLabel({ kind: 'local' })}
          row={buildAgentCatalogRowProps(entry, isFoundHere, {
            settings,
            updateSettings,
            piRuntime
          })}
        />
      ) : null}
    </div>
  )
}
