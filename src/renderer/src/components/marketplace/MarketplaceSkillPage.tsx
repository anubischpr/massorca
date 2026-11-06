import { useState } from 'react'
import { BookOpen, FolderOpen, Puzzle, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { installableSkillProviders } from '../../../../shared/skill-install-providers'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { useSkillInstallDetectedAgents } from '../skills/use-skill-install-detected-agents'
import {
  MarketplaceBreadcrumb,
  MarketplaceCard,
  MarketplaceCardLabel,
  MarketplaceCardRow,
  MarketplaceItemHeader
} from './MarketplaceDetail'
import { MarketplaceHomeHostPicker } from './MarketplaceHomeHostPicker'
import {
  marketplaceSkillReachesAgent,
  type MarketplaceSkillOrigin,
  type MarketplaceSkillPageSkill
} from './MarketplaceSkillPageModel'
import { MarketplaceSkillTeams } from './MarketplaceSkillTeams'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

const ORIGIN_ICONS: Record<MarketplaceSkillOrigin['kind'], typeof Store> = {
  pool: Store,
  folder: FolderOpen,
  plugin: Puzzle
}

/** A skill's page ("Skill" board): install state, the agents that get it, bot teams and its source. */
export function MarketplaceSkillPage({
  skill,
  hostName = translate(
    'auto.components.marketplace.MarketplaceAgentPage.thisComputer',
    'This computer'
  ),
  onBack
}: {
  skill: MarketplaceSkillPageSkill
  hostName?: string
  onBack: () => void
}): React.JSX.Element {
  const [installOpen, setInstallOpen] = useState(false)
  const host = useMarketplaceAppHost()
  const OriginIcon = ORIGIN_ICONS[skill.origin.kind]
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MarketplaceBreadcrumb name={skill.name} onBack={onBack} />
        {/* Why: same host list as the Marketplace home and app pages. */}
        {host.targets.length === 0 ? null : <MarketplaceHomeHostPicker host={host} />}
      </div>
      <MarketplaceItemHeader
        icon={<BookOpen className="size-6" aria-hidden />}
        name={skill.name}
        description={skill.description}
        statusTone={skill.installed ? 'ok' : 'warn'}
        status={
          skill.installed
            ? translate(
                'auto.components.marketplace.MarketplaceSkillPage.installedOn',
                'Installed on {{host}}',
                { host: hostName }
              )
            : translate(
                'auto.components.marketplace.MarketplaceSkillPage.notInstalledOn',
                'Not installed on {{host}}',
                { host: hostName }
              )
        }
        action={
          skill.installed ? undefined : (
            <Button type="button" onClick={() => setInstallOpen(true)}>
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.installOn',
                'Install on {{host}}',
                { host: hostName }
              )}
            </Button>
          )
        }
      />
      <MarketplaceSkillAgents agentIds={skill.agentIds} hostName={hostName} />
      <MarketplaceSkillTeams skillName={skill.name} />
      <section data-marketplace-skill-origin>
        <MarketplaceCard>
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold">
              {translate(
                'auto.components.marketplace.MarketplaceSkillPage.origin',
                'Where it comes from'
              )}
            </h3>
          </div>
          <MarketplaceCardRow
            name={skill.origin.name}
            description={skill.origin.detail}
            leading={<OriginIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          />
        </MarketplaceCard>
      </section>
      {installOpen ? (
        <SkillInstallDialog open initialLink={skill.installLink} onOpenChange={setInstallOpen} />
      ) : null}
    </div>
  )
}

/** "Workspaces": the agents on this host, pressed when they already read the skill. */
function MarketplaceSkillAgents({
  agentIds,
  hostName
}: {
  agentIds: readonly string[]
  hostName: string
}): React.JSX.Element {
  const detected = useSkillInstallDetectedAgents({ environmentId: 'local' })
  const agents = installableSkillProviders(detected ?? [])
  // Why: a press is held here; placing or removing one agent's copy has no backend yet.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null)
  const selected =
    picked ??
    new Set(
      agents
        .filter((provider) => marketplaceSkillReachesAgent(provider, agentIds))
        .map((provider) => provider.id)
    )
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
          <div className="flex flex-wrap gap-1.5">
            {agents.map((provider) => (
              <Toggle
                key={provider.id}
                variant="outline"
                size="sm"
                pressed={selected.has(provider.id)}
                onPressedChange={(pressed) => {
                  const next = new Set(selected)
                  if (pressed) {
                    next.add(provider.id)
                  } else {
                    next.delete(provider.id)
                  }
                  setPicked(next)
                }}
              >
                {provider.displayName}
              </Toggle>
            ))}
          </div>
        </div>
      </MarketplaceCard>
    </section>
  )
}
