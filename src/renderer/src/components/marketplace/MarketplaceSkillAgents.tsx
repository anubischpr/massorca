import { Toggle } from '@/components/ui/toggle'
import { translate } from '@/i18n/i18n'
import type {
  SkillInstallProviderDefinition,
  SkillInstallProviderId
} from '../../../../shared/skill-install-providers'
import { MarketplaceCard, MarketplaceCardLabel } from './MarketplaceDetail'
import type { SkillSwitchLock } from './marketplace-skill-agent-switches'

/** "Workspaces": the agents on the host the page reads, pressed when they read the skill; a press places or removes its copy. */
export function MarketplaceSkillAgents({
  hostName,
  providers,
  notice,
  selected,
  busy,
  installed,
  lock,
  onToggle
}: {
  hostName: string
  providers: readonly SkillInstallProviderDefinition[]
  notice: string | null
  selected: ReadonlySet<SkillInstallProviderId>
  busy: boolean
  installed: boolean
  lock: SkillSwitchLock
  onToggle: (provider: SkillInstallProviderId, pressed: boolean) => void
}): React.JSX.Element {
  return (
    <section data-marketplace-skill-agents>
      <MarketplaceCardLabel>
        {translate('auto.components.marketplace.MarketplaceSkillPage.workspaces', 'Workspaces')}
      </MarketplaceCardLabel>
      <MarketplaceCard>
        <div className="flex flex-col gap-2.5 px-4 py-3">
          <div>
            <span className="block text-sm font-medium">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.agents',
                'Agents that get it'
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.agentsHelp',
                'Only agents installed on {{host}} are listed. Each one keeps its own copy.',
                { host: hostName }
              )}
            </span>
          </div>
          {notice !== null ? (
            <span className="text-sm text-muted-foreground">{notice}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {providers.map((provider) => (
                <Toggle
                  key={provider.id}
                  variant="outline"
                  size="sm"
                  disabled={
                    busy ||
                    lock !== 'none' ||
                    // Why: an installed copy keeps at least one agent; Remove is the way to drop them all.
                    (installed && selected.size === 1 && selected.has(provider.id))
                  }
                  pressed={selected.has(provider.id)}
                  onPressedChange={(pressed) => onToggle(provider.id, pressed)}
                >
                  {provider.displayName}
                </Toggle>
              ))}
            </div>
          )}
          {lock === 'unmanaged' ? (
            <span className="text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.unmanagedLock',
                'MassOrca did not install this copy, so its agents cannot be changed here.'
              )}
            </span>
          ) : null}
        </div>
      </MarketplaceCard>
    </section>
  )
}
