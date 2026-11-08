import { useEffect, useState } from 'react'
import { BookOpen, FolderOpen, Link, Puzzle, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import {
  MarketplaceBreadcrumb,
  MarketplaceCard,
  MarketplaceCardRow,
  MarketplaceItemHeader
} from './MarketplaceDetail'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MarketplaceIntegrationAdvanced } from './MarketplaceIntegrationAdvanced'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import { MarketplaceSkillAgents } from './MarketplaceSkillAgents'
import { MarketplaceSkillCopies } from './MarketplaceSkillCopies'
import { MarketplaceSkillDanger } from './MarketplaceSkillDanger'
import { MarketplaceSkillTeams } from './MarketplaceSkillTeams'
import {
  useManagedSkillInstall,
  useSkillAgentSwitches,
  useSkillHostAgents
} from './marketplace-skill-agent-switches'
import { skillDisplayName } from './marketplace-skill-display-name'
import { skillInstallTargetFor } from './marketplace-skill-host-install'
import { skillRemoveTargetFor, skillRemoveUnavailableReason } from './marketplace-skill-remove'
import {
  marketplaceSkillReachesAgent,
  type MarketplaceSkillOrigin,
  type MarketplaceSkillPageSkill
} from './MarketplaceSkillPageModel'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { useMarketplaceAppHost, type MarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'

const ORIGIN_ICONS: Record<MarketplaceSkillOrigin['kind'], typeof Store> = {
  pool: Store,
  folder: FolderOpen,
  plugin: Puzzle,
  custom: Link
}

/** The picked host when it is not this computer; the page reads and acts on that host only. */
function pickedRemoteTarget(host: MarketplaceAppHost): MarketplaceVaultHostTarget | null {
  if (host.selectedKey === null) {
    return null
  }
  return host.targets.find((target) => marketplaceHostKey(target) === host.selectedKey) ?? null
}

const NO_COPIES: readonly DiscoveredSkill[] = []

/** A skill's page ("Skill" board): install state, the agents that get it, every copy, bot teams, its source and removal. */
export function MarketplaceSkillPage({
  skill,
  copies = NO_COPIES,
  hostName = translate(
    'auto.components.marketplace.MarketplaceAgentPage.thisComputer',
    'This computer'
  ),
  focusedRuntime = null,
  onBack,
  onRescan
}: {
  skill: MarketplaceSkillPageSkill
  /** Every copy of the skill on the host the page reads; Remove deletes them all. */
  copies?: readonly DiscoveredSkill[]
  hostName?: string
  /** The runtime this computer's skill scan reads; Remove deletes through the same runtime. */
  focusedRuntime?: RuntimeClientTarget | null
  onBack: () => void
  /** Reads the skill again on the picked host; called after a switch or a removal lands there. */
  onRescan?: () => void
}): React.JSX.Element {
  const [installOpen, setInstallOpen] = useState(false)
  const host = useMarketplaceAppHost()
  const OriginIcon = ORIGIN_ICONS[skill.origin.kind]
  const remoteTarget = pickedRemoteTarget(host)
  const agents = useSkillHostAgents(remoteTarget, hostName)
  const managed = useManagedSkillInstall(remoteTarget, skill.folders, skill.installed)
  const readers = new Set(
    agents.providers
      .filter((provider) => marketplaceSkillReachesAgent(provider, skill.agentIds))
      .map((provider) => provider.id)
  )
  const switches = useSkillAgentSwitches({
    installed: skill.installed,
    readers,
    managed,
    target: remoteTarget
  })
  const displayName = skillDisplayName(skill.name)

  useEffect(() => {
    if (onRescan === undefined) {
      return undefined
    }
    window.addEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onRescan)
    return () => window.removeEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onRescan)
  }, [onRescan])

  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex max-w-4xl flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <MarketplaceBreadcrumb name={displayName} onBack={onBack} />
      </MarketplacePageHostRow>
      <MarketplaceItemHeader
        icon={<BookOpen className="size-6" aria-hidden />}
        name={displayName}
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
      {skill.installed ? (
        <MarketplaceFunctionNote part="install">
          {translate(
            'auto.components.marketplace.MarketplaceSkillPage.alreadyInstalled',
            'Already installed on {{host}}, so there is nothing to install.',
            { host: hostName }
          )}
        </MarketplaceFunctionNote>
      ) : null}
      <MarketplaceSkillAgents
        hostName={hostName}
        providers={agents.providers}
        notice={agents.notice}
        selected={switches.selected}
        busy={switches.busy}
        installed={skill.installed}
        lock={switches.lock}
        onToggle={switches.onToggle}
      />
      <MarketplaceSkillCopies copies={copies} hostName={hostName} />
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
      <MarketplaceFunctionNote part="banner">
        {translate(
          'auto.components.marketplace.MarketplaceSkillPage.noBanner',
          '{{name}} has no example prompts.',
          { name: displayName }
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
            'auto.components.marketplace.MarketplaceSkillPage.noConnection',
            'A skill needs no account. Each copy sits in an agent folder on the host.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceAppSection>
      <MarketplaceIntegrationAdvanced>
        <MarketplaceFunctionNote part="advanced">
          {translate(
            'auto.components.marketplace.MarketplaceSkillPage.noAdvanced',
            'A skill has no options of its own. Its copies and agents are above.'
          )}
        </MarketplaceFunctionNote>
      </MarketplaceIntegrationAdvanced>
      {copies.length === 0 ? (
        <MarketplaceAppSection
          id="danger"
          title={translate('auto.components.marketplace.MarketplaceAppDanger.title', 'Danger zone')}
        >
          <MarketplaceFunctionNote part="uninstall">
            {translate(
              'auto.components.marketplace.MarketplaceSkillPage.notOnHostRemove',
              'Not installed on {{host}}, so there is no copy to remove.',
              { host: hostName }
            )}
          </MarketplaceFunctionNote>
        </MarketplaceAppSection>
      ) : (
        <MarketplaceSkillDanger
          copies={copies}
          hostName={hostName}
          target={skillRemoveTargetFor(remoteTarget, focusedRuntime)}
          unavailableReason={skillRemoveUnavailableReason(remoteTarget)}
          onGone={onBack}
        />
      )}
      {installOpen ? (
        <SkillInstallDialog
          open
          initialLink={skill.installLink}
          initialTarget={skillInstallTargetFor(remoteTarget, [...switches.selected])}
          onOpenChange={setInstallOpen}
        />
      ) : null}
    </div>
  )
}
