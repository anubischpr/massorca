import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { notifyInstalledAgentSkillsChanged } from '@/hooks/useInstalledAgentSkills'
import { translate } from '@/i18n/i18n'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import {
  installableSkillProviders,
  type SkillInstallProviderDefinition,
  type SkillInstallProviderId
} from '../../../../shared/skill-install-providers'
import { toggledSkillProviderSelection } from '../skills/skill-install-provider-groups'
import { useSkillInstallDetectedAgents } from '../skills/use-skill-install-detected-agents'
import { readManagedSkillInstalls } from './marketplace-managed-skills'
import {
  agentSwitchInstallRequest,
  installsOnHost,
  managedInstallForFolder,
  managedListingEnvironmentId
} from './marketplace-skill-host-install'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceRemoteDetection } from './use-marketplace-remote-detection'

/** The global install of a skill on the picked host: still being read, not placed by MassOrca, or the install. */
export type ManagedSkillState =
  | { kind: 'checking' }
  | { kind: 'unmanaged' }
  | { kind: 'managed'; install: ManagedSkillInstall }

/** Why the agent switches cannot change: nothing, the install is still being read, or MassOrca did not place the copy. */
export type SkillSwitchLock = 'none' | 'checking' | 'unmanaged'

export type SkillAgentSwitches = {
  selected: ReadonlySet<SkillInstallProviderId>
  busy: boolean
  lock: SkillSwitchLock
  onToggle: (provider: SkillInstallProviderId, pressed: boolean) => void
}

/**
 * The agents a host has, read through its own probe: this computer's from here, a picked host's from its
 * reads. A host that cannot answer says so instead of listing none.
 */
export function useSkillHostAgents(
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
 * The global install of a skill's copy on the picked host, read once the skill is installed there. A copy
 * in any of the folders counts; a workspace copy is not what the host-level switches change.
 */
export function useManagedSkillInstall(
  target: MarketplaceVaultHostTarget | null,
  folders: readonly string[],
  installed: boolean
): ManagedSkillState {
  const key = `${target === null ? 'local' : marketplaceHostKey(target)}\0${folders.join('\0')}\0${installed}`
  const [answer, setAnswer] = useState<{ key: string; state: ManagedSkillState } | null>(null)
  useEffect(() => {
    if (!installed || folders.length === 0) {
      return undefined
    }
    let current = true
    void readManagedSkillInstalls(managedListingEnvironmentId(target)).then((installs) => {
      if (!current) {
        return
      }
      const onHost = installsOnHost(target, installs)
      const install = folders
        .map((folder) => managedInstallForFolder(onHost, folder))
        .find((found) => found !== undefined)
      setAnswer({
        key,
        state: install === undefined ? { kind: 'unmanaged' } : { kind: 'managed', install }
      })
    })
    return () => {
      current = false
    }
  }, [key, target, folders, installed])
  if (!installed || folders.length === 0) {
    return { kind: 'unmanaged' }
  }
  return answer?.key === key ? answer.state : { kind: 'checking' }
}

/**
 * The page's agent switches. For a skill that is not installed yet, a press sets the agents its install starts
 * with. For an installed copy MassOrca placed, a press reinstalls it with the agents the switches show.
 */
export function useSkillAgentSwitches({
  installed,
  readers,
  managed,
  target
}: {
  installed: boolean
  readers: ReadonlySet<SkillInstallProviderId>
  managed: ManagedSkillState
  target: MarketplaceVaultHostTarget | null
}): SkillAgentSwitches {
  const [picked, setPicked] = useState<ReadonlySet<SkillInstallProviderId> | null>(null)
  const [busy, setBusy] = useState(false)
  const readersKey = [...readers].sort().join(',')
  // Why: a new read of the agents replaces the switches the person set, so the page shows what is on the host.
  useEffect(() => {
    setPicked(null)
  }, [readersKey])

  const selected = picked ?? readers
  const lock: SkillSwitchLock = !installed
    ? 'none'
    : managed.kind === 'checking'
      ? 'checking'
      : managed.kind === 'managed'
        ? 'none'
        : 'unmanaged'

  const onToggle = (provider: SkillInstallProviderId, pressed: boolean): void => {
    const next = toggledSkillProviderSelection(selected, provider, pressed)
    if (!installed) {
      setPicked(next)
      return
    }
    // Why: an installed copy keeps at least one agent; the Remove action deletes it instead.
    if (managed.kind !== 'managed' || next.size === 0) {
      return
    }
    setPicked(next)
    setBusy(true)
    void window.api.skills
      .installPackageVersion(agentSwitchInstallRequest(target, managed.install, [...next]))
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
      .finally(() => setBusy(false))
  }

  return { selected, busy, lock, onToggle }
}

function agentSwitchFailedText(): string {
  return translate(
    'auto.components.marketplace.MarketplaceSkillPage.agentSwitchFailed',
    'Could not change the agents for this skill.'
  )
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
