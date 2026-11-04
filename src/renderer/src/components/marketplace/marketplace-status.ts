import type { PreflightStatus } from '../../../../preload/api-types'
import type { MarketplaceAppId, MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import type { MarketplaceAppsState } from '@/store/slices/ui/ui-slice-contract-core'
import type { MarketplaceItemId } from './marketplace-catalog'

export type MarketplaceBadgeState =
  | 'checking'
  | 'unknown'
  | 'installed'
  | 'not-installed'
  | 'signed-in'
  | 'not-signed-in'
  | 'connected'
  | 'not-connected'
  | 'desktop-only'

export type MarketplaceStatusInputs = {
  // Null when the preflight result is not for this computer or the check failed.
  preflight: PreflightStatus | null
  preflightChecked: boolean
  apps: MarketplaceAppsState
}

export function marketplaceBadgeState(
  itemId: MarketplaceItemId,
  inputs: MarketplaceStatusInputs
): MarketplaceBadgeState {
  switch (itemId) {
    case 'git':
      return gitBadgeState(inputs)
    case 'github':
      return githubBadgeState(inputs)
    case 'engram':
    case 'openmetadata':
      return appBadgeState(itemId, inputs.apps)
  }
}

export function appStatusFor(
  apps: MarketplaceAppsState,
  id: MarketplaceAppId
): MarketplaceAppStatus | undefined {
  return apps.status === 'ready' ? apps.apps.find((app) => app.id === id) : undefined
}

function gitBadgeState({
  preflight,
  preflightChecked
}: MarketplaceStatusInputs): MarketplaceBadgeState {
  if (!preflightChecked) {
    return 'checking'
  }
  if (!preflight) {
    return 'unknown'
  }
  return preflight.git.installed ? 'installed' : 'not-installed'
}

function githubBadgeState({
  preflight,
  preflightChecked
}: MarketplaceStatusInputs): MarketplaceBadgeState {
  if (!preflightChecked) {
    return 'checking'
  }
  if (!preflight) {
    return 'unknown'
  }
  if (!preflight.gh.installed) {
    return 'not-installed'
  }
  return preflight.gh.authenticated ? 'signed-in' : 'not-signed-in'
}

function appBadgeState(id: MarketplaceAppId, apps: MarketplaceAppsState): MarketplaceBadgeState {
  switch (apps.status) {
    case 'loading':
      return 'checking'
    case 'unavailable':
      return 'desktop-only'
    case 'failed':
      return 'unknown'
    case 'ready':
      return appStatusFor(apps, id)?.connected ? 'connected' : 'not-connected'
  }
}
