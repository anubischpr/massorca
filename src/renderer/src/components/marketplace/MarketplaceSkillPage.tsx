import { useEffect, useState } from 'react'
import { BookOpen, FolderOpen, Puzzle, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import { notifyInstalledAgentSkillsChanged } from '@/hooks/useInstalledAgentSkills'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  installableSkillProviders,
  type SkillInstallProviderDefinition,
  type SkillInstallProviderId
} from '../../../../shared/skill-install-providers'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { toggledSkillProviderSelection } from '../skills/skill-install-provider-groups'
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
import { readManagedSkillInstalls } from './marketplace-managed-skills'
import {
  agentSwitchInstallRequest,
  installsOnHost,
  managedInstallForFolder,
  managedListingEnvironmentId,
  skillInstallTargetFor
} from './marketplace-skill-host-install'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { useMarketplaceAppHost, type MarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceRemoteDetection } from './use-marketplace-remote-detection'

const ORIGIN_ICONS: Record<MarketplaceSkillOrigin['kind'], typeof Store> = {
  pool: Store,
  folder: FolderOpen,
  plugin: Puzzle
}

/** The picked host when it is not this computer; the page reads and acts on that host only. */
function pickedRemoteTarget(host: MarketplaceAppHost): MarketplaceVaultHostTarget | null {
  if (host.selectedKey === null) {
    return null
  }
  return host.targets.find((target) => marketplaceHostKey(target) === host.selectedKey) ?? null
}

/** A skill's page ("Skill" board): install state, the agents that get it, bot teams and its source. */
export function MarketplaceSkillPage({
  skill,
  hostName = translate(
    'auto.components.marketplace.MarketplaceAgentPage.thisComputer',
    'This computer'
  ),
  onBack,
  onRescan
}: {
  skill: MarketplaceSkillPageSkill
  hostName?: string
  onBack: () => void
  /** Reads the skill again on the picked host; called after an install lands there. */
  onRescan?: () => void
}): React.JSX.Element {
  const [installOpen, setInstallOpen] = useState(false)
  const host = useMarketplaceAppHost()
  const OriginIcon = ORIGIN_ICONS[skill.origin.kind]
  const remoteTarget = pickedRemoteTarget(host)
  const agents = useSkillHostAgents(remoteTarget, hostName)
  const managed = useManagedSkillInstall(remoteTarget, skill.folder, skill.installed)
  const [picked, setPicked] = useState<ReadonlySet<SkillInstallProviderId> | null>(null)
  const [applying, setApplying] = useState(false)
  // Why: the switches are one selection for the page; an install starts with it, and a copy already here follows it.
  const selected =
    picked ??
    new Set(
      agents.providers
        .filter((provider) => marketplaceSkillReachesAgent(provider, skill.agentIds))
        .map((provider) => provider.id)
    )

  useEffect(() => {
    if (onRescan === undefined) {
      return undefined
    }
    window.addEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onRescan)
    return () => window.removeEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onRescan)
  }, [onRescan])

  const onToggle = (provider: SkillInstallProviderId, pressed: boolean): void => {
    const next = toggledSkillProviderSelection(selected, provider, pressed)
    // Why: a copy already on this host follows the switches only when at least one agent stays; otherwise the switch is starting state.
    if (managed === null || next.size === 0) {
      setPicked(next)
      return
    }
    setPicked(next)
    setApplying(true)
    void window.api.skills
      .installPackageVersion(agentSwitchInstallRequest(remoteTarget, managed, [...next]))
      .then(
        (operation) => {
          if (
            operation.status === 'ok' &&
            !['conflict', 'failed', 'cancelled'].includes(operation.value.status)
          ) {
            notifyInstalledAgentSkillsChanged()
            return
          }
          setPicked(null)
          toast.error(agentSwitchFailedText())
        },
        () => {
          setPicked(null)
          toast.error(agentSwitchFailedText())
        }
      )
      .finally(() => setApplying(false))
  }

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
      <MarketplaceSkillAgents
        hostName={hostName}
        providers={agents.providers}
        notice={agents.notice}
        selected={selected}
        busy={applying}
        onToggle={onToggle}
      />
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
        <SkillInstallDialog
          open
          initialLink={skill.installLink}
          initialTarget={skillInstallTargetFor(remoteTarget, [...selected])}
          onOpenChange={setInstallOpen}
        />
      ) : null}
    </div>
  )
}

function agentSwitchFailedText(): string {
  return translate(
    'auto.components.marketplace.MarketplaceSkillPage.agentSwitchFailed',
    'Could not change the agents for this skill.'
  )
}

/**
 * The agents a host has, read through its own probe: this computer's from here, a picked host's from its
 * reads. A host that cannot answer says so instead of listing none.
 */
function useSkillHostAgents(
  target: MarketplaceVaultHostTarget | null,
  hostName: string
): { providers: SkillInstallProviderDefinition[]; notice: string | null } {
  const localDetected = useSkillInstallDetectedAgents({ environmentId: 'local' })
  const remote = useMarketplaceRemoteDetection(target).agents
  if (target === null) {
    return { providers: installableSkillProviders(localDetected ?? []), notice: null }
  }
  if (remote.kind === 'ready') {
    return { providers: installableSkillProviders([...remote.value]), notice: null }
  }
  return { providers: [], notice: remoteAgentsNotice(remote.kind, hostName) }
}

/**
 * The global install of this skill on the picked host, read once the skill is installed there. Null when
 * there is none (or it is not read yet), so the switches stay starting state.
 */
function useManagedSkillInstall(
  target: MarketplaceVaultHostTarget | null,
  folder: string | undefined,
  installed: boolean
): ManagedSkillInstall | null {
  const key = `${target === null ? 'local' : marketplaceHostKey(target)}\0${folder ?? ''}\0${installed}`
  const [answer, setAnswer] = useState<{ key: string; install: ManagedSkillInstall | null } | null>(
    null
  )
  useEffect(() => {
    if (!installed || folder === undefined) {
      return undefined
    }
    let current = true
    void readManagedSkillInstalls(managedListingEnvironmentId(target)).then((installs) => {
      if (current) {
        setAnswer({
          key,
          install: managedInstallForFolder(installsOnHost(target, installs), folder) ?? null
        })
      }
    })
    return () => {
      current = false
    }
  }, [key, target, folder, installed])
  return answer?.key === key ? answer.install : null
}

function remoteAgentsNotice(
  kind: 'loading' | 'failed' | 'update-required',
  hostName: string
): string {
  if (kind === 'loading') {
    return translate(
      'auto.components.marketplace.MarketplaceSkillPage.checkingOn',
      'Checking {{host}}…',
      { host: hostName }
    )
  }
  if (kind === 'update-required') {
    return translate(
      'auto.components.marketplace.MarketplaceSkillPage.updateToCheck',
      'Update {{host}} to check its agents.',
      { host: hostName }
    )
  }
  return translate(
    'auto.components.marketplace.MarketplaceSkillPage.couldNotCheckOn',
    'Could not check {{host}}',
    { host: hostName }
  )
}

/** "Workspaces": the agents on the host the page reads, pressed when they read the skill; a press places or removes its copy. */
function MarketplaceSkillAgents({
  hostName,
  providers,
  notice,
  selected,
  busy,
  onToggle
}: {
  hostName: string
  providers: readonly SkillInstallProviderDefinition[]
  notice: string | null
  selected: ReadonlySet<SkillInstallProviderId>
  busy: boolean
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
                  disabled={busy}
                  pressed={selected.has(provider.id)}
                  onPressedChange={(pressed) => onToggle(provider.id, pressed)}
                >
                  {provider.displayName}
                </Toggle>
              ))}
            </div>
          )}
        </div>
      </MarketplaceCard>
    </section>
  )
}
