import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { AgentIcon, getAgentCatalog, getAgentDisplayLabel } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { buildAgentCatalogRowProps } from '../settings/agent-settings-row-props'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAgentHosts, useMarketplaceAgentHosts } from './MarketplaceAgentHosts'
import {
  marketplaceAgentHostKey,
  marketplaceAgentHostLabel,
  marketplaceAgentHostsSummary,
  type MarketplaceAgentDetection
} from './MarketplaceAgentHostState'
import { MarketplaceAgentSettings } from './MarketplaceAgentSettings'
import { MarketplaceBreadcrumb, MarketplaceItemHeader } from './MarketplaceDetail'

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

/** An agent across every host ("Agent on each host" board), then its settings on this computer. */
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
  const hosts = useMarketplaceAgentHosts()
  const [detections, setDetections] = useState<Record<string, MarketplaceAgentDetection>>({})
  const reportDetection = useCallback((key: string, detection: MarketplaceAgentDetection) => {
    setDetections((current) =>
      current[key] === detection ? current : { ...current, [key]: detection }
    )
  }, [])
  const entry = getAgentCatalog().find((agent) => agent.id === agentId)
  const name = getAgentDisplayLabel(agentId, piRuntime)
  const description = AGENT_DESCRIPTIONS[agentId]
  const summary = marketplaceAgentHostsSummary(
    hosts.map((host) => detections[marketplaceAgentHostKey(host)] ?? 'checking')
  )
  const isFoundHere = detectedIds?.includes(agentId) ?? false
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplaceBreadcrumb name={name} onBack={onBack} />
      <MarketplaceItemHeader
        icon={<AgentIcon agent={agentId} size={30} />}
        name={name}
        description={description ? translate(description.key, description.fallback) : null}
        statusTone={summary.tone}
        status={summary.text}
      />
      <MarketplaceAgentHosts
        hosts={hosts}
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
