import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import type { PreflightIntegrationStatuses } from '../settings/integrations-pane-status'
import { usePreflightCardStatuses } from '../settings/source-control-preflight-card-status'
import type {
  MarketplaceIntegrationState,
  MarketplaceIntegrationStates
} from './marketplace-integrations'

/** A task provider's state as the Settings card reads it: unchecked for this runtime reads as checking. */
export type TaskProviderState = { checking: boolean; connected: boolean }

function tokenState(
  status: string,
  connectedStatus: 'connected' | 'configured',
  unavailable: boolean
): MarketplaceIntegrationState {
  if (unavailable) {
    return 'unavailable'
  }
  if (status === 'checking') {
    return 'checking'
  }
  return status === connectedStatus ? 'connected' : 'not-connected'
}

function taskState(provider: TaskProviderState): MarketplaceIntegrationState {
  if (provider.checking) {
    return 'checking'
  }
  return provider.connected ? 'connected' : 'not-connected'
}

/** Pure mapping from the Settings checks to the Marketplace states, so rows and pages cannot disagree. */
export function deriveIntegrationStates(input: {
  statuses: PreflightIntegrationStatuses
  unavailable: boolean
  linear: TaskProviderState
  jira: TaskProviderState
}): MarketplaceIntegrationStates {
  const { statuses, unavailable } = input
  return {
    gitlab: tokenState(statuses.glabStatus, 'connected', unavailable),
    bitbucket: tokenState(statuses.bitbucketStatus, 'connected', unavailable),
    'azure-devops': tokenState(statuses.azureDevOpsStatus, 'configured', unavailable),
    gitea: tokenState(statuses.giteaStatus, 'configured', unavailable),
    linear: taskState(input.linear),
    jira: taskState(input.jira)
  }
}

export function useLinearConnectionState(): TaskProviderState {
  const status = useAppStore((s) => s.linearStatus)
  const checked = useAppStore((s) => s.linearStatusChecked)
  const contextKey = useAppStore((s) => s.linearStatusContextKey)
  const settings = useAppStore((s) => s.settings)
  const contextMatches = contextKey === getProviderRuntimeContextKey(settings)
  return {
    checking: !contextMatches || !checked,
    connected: contextMatches && status.connected
  }
}

export function useJiraConnectionState(): TaskProviderState {
  const status = useAppStore((s) => s.jiraStatus)
  const checked = useAppStore((s) => s.jiraStatusChecked)
  const contextKey = useAppStore((s) => s.jiraStatusContextKey)
  const settings = useAppStore((s) => s.settings)
  const contextMatches = contextKey === getProviderRuntimeContextKey(settings)
  return {
    checking: !contextMatches || !checked,
    connected: contextMatches && status.connected
  }
}

/** The six Settings connections as the Marketplace shows them; the page keeps their checks fresh. */
export function useMarketplaceIntegrationStates(): MarketplaceIntegrationStates {
  const { statuses, unavailable } = usePreflightCardStatuses('glab')
  const linear = useLinearConnectionState()
  const jira = useJiraConnectionState()
  return deriveIntegrationStates({ statuses, unavailable, linear, jira })
}
