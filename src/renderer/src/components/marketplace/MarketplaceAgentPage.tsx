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
import { MarketplaceAppSection } from './MarketplaceAppSection'
import { MarketplaceBreadcrumb, MarketplaceItemHeader } from './MarketplaceDetail'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
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
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={name} onBack={onBack} />
      </MarketplacePageHostRow>
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
      <MarketplaceFunctionNote part="banner">
        {translate(
          'auto.components.marketplace.MarketplaceAgentPage.noBanner',
          '{{name}} has no example prompts.',
          { name }
        )}
      </MarketplaceFunctionNote>
      <MarketplaceAppSection
        id="connection"
        title={translate(
          'auto.components.marketplace.MarketplaceAppConnection.title',
          'Connection'
        )}
      >
        <MarketplaceFunctionNote part="connection">
          {translate(
            'auto.components.marketplace.MarketplaceAgentPage.noConnection',
            'Each agent keeps its own sign-in on each host. MassOrca does not connect agents.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote part="advanced">
          {translate(
            'auto.components.marketplace.MarketplaceAgentPage.noAdvanced',
            'The launch command and environment variables are in the On card above.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      <MarketplaceAppSection
        id="danger"
        title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
      >
        <MarketplaceFunctionNote part="uninstall">
          {translate(
            'auto.components.marketplace.MarketplaceAgentPage.noUninstall',
            'MassOrca does not uninstall {{name}}. Remove it with its own uninstaller.',
            { name }
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
    </div>
  )
}
