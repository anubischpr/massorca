import { ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import {
  AgentIcon,
  getAgentCatalog,
  getAgentDisplayLabel,
  type AgentCatalogEntry
} from '@/lib/agent-catalog'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import type { PiDisplayRuntime } from '@/lib/pi-agent-display'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { SettingsBadge } from '../settings/SettingsFormControls'

/** Every known agent, found on this computer first; a row opens that agent's page. */
export function MarketplaceAgentsSection({
  onSelect
}: {
  onSelect: (agent: TuiAgent) => void
}): React.JSX.Element {
  const { detectedIds } = useDetectedAgents(null)
  const piRuntime = usePiDisplayRuntime()
  if (detectedIds === null) {
    return (
      <p className="px-5 py-3 text-sm text-muted-foreground md:px-8">
        {translate(
          'auto.components.marketplace.MarketplaceAgentsSection.checking',
          'Checking this computer…'
        )}
      </p>
    )
  }
  const catalog = getAgentCatalog()
  const found = catalog.filter((agent) => detectedIds.includes(agent.id))
  const notFound = catalog.filter((agent) => !detectedIds.includes(agent.id))
  return (
    <div className="flex flex-col">
      <AgentGroup
        title={translate(
          'auto.components.marketplace.MarketplaceAgentsSection.foundTitle',
          'Found on this computer'
        )}
        agents={found}
        isFound
        piRuntime={piRuntime}
        onSelect={onSelect}
      />
      <AgentGroup
        title={translate(
          'auto.components.marketplace.MarketplaceAgentsSection.notFoundTitle',
          'Not found'
        )}
        agents={notFound}
        isFound={false}
        piRuntime={piRuntime}
        onSelect={onSelect}
      />
    </div>
  )
}

function AgentGroup({
  title,
  agents,
  isFound,
  piRuntime,
  onSelect
}: {
  title: string
  agents: readonly AgentCatalogEntry[]
  isFound: boolean
  piRuntime: PiDisplayRuntime
  onSelect: (agent: TuiAgent) => void
}): React.JSX.Element | null {
  if (agents.length === 0) {
    return null
  }
  return (
    <section>
      <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground md:px-8">
        {title}
      </p>
      <ul className="border-t border-border">
        {agents.map((agent) => (
          <li key={agent.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => onSelect(agent.id)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent md:px-8"
            >
              <AgentIcon agent={agent.id} size={16} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {getAgentDisplayLabel(agent.id, piRuntime)}
              </span>
              <SettingsBadge tone={isFound ? 'accent' : 'muted'}>
                {isFound
                  ? translate('auto.components.marketplace.MarketplaceAgentsSection.found', 'Found')
                  : translate(
                      'auto.components.marketplace.MarketplaceAgentsSection.notFound',
                      'Not found'
                    )}
              </SettingsBadge>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
