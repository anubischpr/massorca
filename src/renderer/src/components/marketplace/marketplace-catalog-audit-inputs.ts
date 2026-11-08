import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { getSingleFocusedRuntimeEnvironmentId } from '@/lib/single-runtime-legacy-owner'
import { isWebClientLocation } from '@/lib/web-client-location'
import { loadWindowsTerminalCapabilities } from '@/lib/windows-terminal-capabilities'
import { getActiveRuntimeTarget, type RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import { useAppStore, type AppState } from '@/store'
import type {
  MarketplaceCustomApi,
  MarketplaceCustomItemStatus
} from '../../../../shared/marketplace-custom'
import {
  markMarketplaceManagedSkills,
  readManagedSkillInstalls
} from './marketplace-managed-skills'
import { isWindowsDesktopClient, marketplaceWslTargetsFor } from './marketplace-host-wsl'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { CatalogHostReads } from './MarketplaceCatalogData'
import type { HostUnanswered } from './MarketplaceCatalogRows'
import { deriveIntegrationStates, type TaskProviderState } from './marketplace-integration-status'
import {
  localMarketplaceAgents,
  readLocalPiAnswer,
  type LocalMarketplaceAgents
} from './marketplace-local-agents'
import type { MarketplaceIntegrationStates } from './marketplace-integrations'
import type { MarketplaceInstalledSkills } from './MarketplaceCatalogSkills'
import { getHostDisplayLabelOverrides } from '../../../../shared/host-setting-overrides'
import { marketplaceHostTargetsOf } from './use-marketplace-host-targets'
import { readRemoteHostChecks, type RemoteHostReads } from './use-marketplace-remote-detection'
import type { MarketplacePreflight } from './use-marketplace-preflight'
import {
  type PreflightRefreshProvider,
  getPreflightIntegrationStatuses
} from '../settings/integrations-pane-status'

// Hook-free reads of the Marketplace catalog inputs for one host, for the renderer audit.
// Each read mirrors a hook named beside it and calls the same reader and pure functions.

type LocalDetectionReads = Pick<CatalogHostReads, 'marketplaceAgents' | 'skills' | 'custom'>

const FAILED: HostUnanswered = { kind: 'failed' }
const FAILED_REMOTE_READS: RemoteHostReads = {
  tools: FAILED,
  agents: FAILED,
  piRuntimes: FAILED,
  skills: FAILED,
  apps: FAILED
}
const NO_INSTALLS: ReadonlySet<string> = new Set<string>()
const NOT_CHECKED_PREFLIGHT: MarketplacePreflight = { preflight: null, checked: false }
const LOADING_SKILLS: MarketplaceInstalledSkills = { status: 'loading' }
// Why: a picked host's custom rows show as unavailable, so its local-only reads stay empty.
const REMOTE_DETECTION_READS: LocalDetectionReads = {
  marketplaceAgents: null,
  skills: LOADING_SKILLS,
  custom: { items: null, installingIds: NO_INSTALLS }
}

/** The hosts the Marketplace host picker offers, as useMarketplaceHostTargets builds them. */
export async function readCatalogAuditTargets(): Promise<MarketplaceVaultHostTarget[]> {
  const windowsDesktop = isWindowsDesktop()
  const distros = windowsDesktop ? await readWslDistros() : []
  const state = useAppStore.getState()
  return marketplaceHostTargetsOf(
    {
      repos: state.repos,
      settings: state.settings,
      runtimeEnvironments: state.runtimeEnvironments,
      runtimeStatusByEnvironmentId: state.runtimeStatusByEnvironmentId,
      sshConnectionStates: state.sshConnectionStates,
      sshTargetLabels: state.sshTargetLabels,
      hostLabelOverrides: getHostDisplayLabelOverrides(state.settings)
    },
    marketplaceWslTargetsFor(windowsDesktop, distros)
  )
}

/** The reads one host's catalog is built from, and the runtime that owns its skill scan. */
export async function readCatalogAuditHostReads(
  pickedTarget: MarketplaceVaultHostTarget | null,
  hostLabel: string
): Promise<{ reads: CatalogHostReads; skillTarget: RuntimeClientTarget | null }> {
  const local = pickedTarget === null
  const skillTarget = readSkillDiscoveryTarget(useAppStore.getState())
  const [preflight, detection, remote] = await Promise.all([
    local ? readLocalPreflight() : NOT_CHECKED_PREFLIGHT,
    local ? readLocalDetection(skillTarget) : REMOTE_DETECTION_READS,
    readRemoteReads(pickedTarget)
  ])
  // Why: read after the preflight refresh, so the integration rows see the same result.
  const state = useAppStore.getState()
  const reads: CatalogHostReads = {
    local,
    hostLabel,
    apps: state.marketplaceApps,
    preflight,
    marketplaceAgents: detection.marketplaceAgents,
    skills: detection.skills,
    custom: detection.custom,
    remote,
    integrations: readIntegrationStates(state)
  }
  return { reads, skillTarget }
}

/** Mirrors isWindowsDesktop in useMarketplaceWslTargets. */
function isWindowsDesktop(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    isWindowsDesktopClient({ userAgent: navigator.userAgent, webClient: isWebClientLocation() })
  )
}

/** Mirrors useLocalWindowsTerminalCapabilities: the local probe; no distros on failure. */
async function readWslDistros(): Promise<readonly string[]> {
  try {
    const capabilities = await loadWindowsTerminalCapabilities({
      ownerKey: 'local',
      target: { kind: 'local' }
    })
    return capabilities.wslDistros
  } catch {
    return []
  }
}

/** Mirrors useActiveSkillDiscoveryRuntimeTarget: unknown until the catalog settles. */
function readSkillDiscoveryTarget(state: AppState): RuntimeClientTarget | null {
  if (!state.runtimeEnvironmentCatalogSettled) {
    return null
  }
  return getActiveRuntimeTarget({
    activeRuntimeEnvironmentId: getSingleFocusedRuntimeEnvironmentId(state)
  })
}

function isPreflightCurrent(state: AppState): boolean {
  return (
    state.preflightStatusContextKey === localPreflightContextKey(getLocalPreflightContext(state))
  )
}

/** Mirrors useMarketplacePreflight (refreshOnMount): refreshes once when missing or stale. */
async function readLocalPreflight(): Promise<MarketplacePreflight> {
  let state = useAppStore.getState()
  if (!state.preflightStatusChecked || !isPreflightCurrent(state)) {
    try {
      await state.refreshPreflightStatus()
    } catch {
      // Why: a failed refresh leaves the unchecked state the page would show.
    }
    state = useAppStore.getState()
  }
  const current = isPreflightCurrent(state)
  return {
    preflight: current ? state.preflightStatus : null,
    checked: state.preflightStatusChecked && current
  }
}

async function readLocalDetection(
  skillTarget: RuntimeClientTarget | null
): Promise<LocalDetectionReads> {
  const [marketplaceAgents, skills, custom] = await Promise.all([
    readLocalAgents(),
    readLocalSkills(skillTarget),
    readLocalCustom()
  ])
  return { marketplaceAgents, skills, custom }
}

/** Mirrors useMarketplaceAgents: the board agents found here and Gentle Shell's Pi answer, or null while detection has no answer. */
async function readLocalAgents(): Promise<LocalMarketplaceAgents | null> {
  let state = useAppStore.getState()
  if (state.detectedAgentIds === null) {
    try {
      await state.ensureDetectedAgents(undefined)
    } catch {
      // Why: a failed probe leaves detectedAgentIds null, which the catalog reads as checking.
    }
    state = useAppStore.getState()
  }
  const detectedIds = state.detectedAgentIds
  if (detectedIds === null) {
    return null
  }
  const command = state.settings?.agentCmdOverrides?.pi
  const hostAnswer = detectedIds.includes('pi')
    ? await readLocalPiAnswer(state.activeWorktreeId ?? '', command)
    : undefined
  return localMarketplaceAgents({ detectedIds, command, hostAnswer })
}

/** Mirrors useMarketplaceInstalledSkills' scan, without the shared snapshot. */
async function readLocalSkills(
  skillTarget: RuntimeClientTarget | null
): Promise<MarketplaceInstalledSkills> {
  if (skillTarget === null) {
    return LOADING_SKILLS
  }
  try {
    const [result, installs] = await Promise.all([
      discoverSkillsForRuntimeTarget(skillTarget),
      readManagedSkillInstalls(skillTarget.kind === 'local' ? undefined : skillTarget.environmentId)
    ])
    return { status: 'ready', skills: markMarketplaceManagedSkills(result.skills, installs) }
  } catch {
    return { status: 'failed' }
  }
}

/** Mirrors useMarketplaceCustomItems: the hand-added items, read once; no installs in flight. */
async function readLocalCustom(): Promise<LocalDetectionReads['custom']> {
  const api: MarketplaceCustomApi | undefined = window.api?.marketplaceCustom
  if (api === undefined) {
    return { items: [], installingIds: NO_INSTALLS }
  }
  try {
    const items: readonly MarketplaceCustomItemStatus[] = await api.list()
    return { items, installingIds: NO_INSTALLS }
  } catch {
    return { items: [], installingIds: NO_INSTALLS }
  }
}

/** Mirrors useMarketplaceRemoteDetection's read: the picked host's checks, or failed with no host. */
async function readRemoteReads(
  target: MarketplaceVaultHostTarget | null
): Promise<RemoteHostReads> {
  if (target === null) {
    return FAILED_REMOTE_READS
  }
  try {
    return await readRemoteHostChecks(target)
  } catch {
    return FAILED_REMOTE_READS
  }
}

/**
 * Mirrors useMarketplaceIntegrationStates. The ready/unavailable/statusInput lines copy
 * usePreflightCardStatuses, and taskProviderState copies useLinear/JiraConnectionState: none is pure.
 */
function readIntegrationStates(state: AppState): MarketplaceIntegrationStates {
  const ready =
    !state.preflightStatusLoading && state.preflightStatusChecked && isPreflightCurrent(state)
  const unavailable = ready && state.preflightStatusError !== null
  const statuses = getPreflightIntegrationStatuses(
    ready && !unavailable ? state.preflightStatus : null,
    new Set<PreflightRefreshProvider>()
  )
  return deriveIntegrationStates({
    statuses,
    unavailable,
    linear: taskProviderState(
      state.linearStatus,
      state.linearStatusChecked,
      state.linearStatusContextKey,
      state.settings
    ),
    jira: taskProviderState(
      state.jiraStatus,
      state.jiraStatusChecked,
      state.jiraStatusContextKey,
      state.settings
    )
  })
}

function taskProviderState(
  status: { connected: boolean },
  checked: boolean,
  contextKey: AppState['linearStatusContextKey'],
  settings: AppState['settings']
): TaskProviderState {
  const contextMatches = contextKey === getProviderRuntimeContextKey(settings)
  return { checking: !contextMatches || !checked, connected: contextMatches && status.connected }
}
