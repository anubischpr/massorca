import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { AgentCatalogRow } from '../settings/AgentCatalogRow'
import { buildAgentCatalogRowProps } from '../settings/agent-settings-row-props'
import { SettingsBadge } from '../settings/SettingsFormControls'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'

/** An agent's page on this computer: found or not, enable, default, command, arguments and environment. */
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
  const entry = getAgentCatalog().find((agent) => agent.id === agentId)
  const isFound = detectedIds?.includes(agentId) ?? false
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-4 py-4')}>
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onBack}>
        {translate('auto.components.marketplace.MarketplaceAgentPage.back', 'Back')}
      </Button>
      {entry && settings && detectedIds !== null ? (
        <section className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {translate(
                'auto.components.marketplace.MarketplaceAgentPage.onThisComputer',
                'On this computer'
              )}
            </p>
            <SettingsBadge tone={isFound ? 'accent' : 'muted'}>
              {isFound
                ? translate('auto.components.marketplace.MarketplaceAgentsSection.found', 'Found')
                : translate(
                    'auto.components.marketplace.MarketplaceAgentsSection.notFound',
                    'Not found'
                  )}
            </SettingsBadge>
          </div>
          <AgentCatalogRow
            {...buildAgentCatalogRowProps(entry, isFound, {
              settings,
              updateSettings,
              piRuntime
            })}
            defaultExpanded
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceAgentsSection.checking',
            'Checking this computer…'
          )}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAgentPage.footer',
          'Settings for this computer. SSH and WSL hosts come later.'
        )}
      </p>
    </div>
  )
}
