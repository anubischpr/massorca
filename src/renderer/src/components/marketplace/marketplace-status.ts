import type { PreflightStatus } from '../../../../preload/api-types'
import {
  MARKETPLACE_MCP_AGENTS,
  type MarketplaceDetection,
  type MarketplaceMcpEntryState
} from '../../../../shared/marketplace-types'
import type { MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceDetectionState } from './use-marketplace-detection'

export type MarketplaceBadgeState =
  | 'checking'
  | 'unknown'
  | 'installed'
  | 'not-installed'
  | 'signed-in'
  | 'not-signed-in'
  | 'set'
  | 'partly-set'
  | 'not-set'
  | 'unreadable'
  | 'desktop-only'
  | 'coming-soon'
  | 'not-supported'

export type MarketplaceStatusInputs = {
  // Null when the preflight result is not for this computer or the check failed.
  preflight: PreflightStatus | null
  preflightChecked: boolean
  detection: MarketplaceDetectionState
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
      return engramBadgeState(inputs.detection)
    case 'openmetadata':
      return openMetadataBadgeState(inputs.detection)
  }
}

export function mcpEntryBadgeState(state: MarketplaceMcpEntryState): MarketplaceBadgeState {
  switch (state) {
    case 'set':
      return 'set'
    case 'missing':
      return 'not-set'
    case 'unreadable':
      return 'unreadable'
  }
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

function engramBadgeState(detection: MarketplaceDetectionState): MarketplaceBadgeState {
  switch (detection.status) {
    case 'loading':
      return 'checking'
    case 'unavailable':
      return 'desktop-only'
    case 'failed':
      return 'unknown'
    case 'ready':
      return detection.detection.engram.cli === 'found' ? 'installed' : 'not-installed'
  }
}

function openMetadataBadgeState(detection: MarketplaceDetectionState): MarketplaceBadgeState {
  switch (detection.status) {
    case 'loading':
      return 'checking'
    case 'unavailable':
      return 'desktop-only'
    case 'failed':
      return 'unknown'
    case 'ready':
      return openMetadataSummary(detection.detection)
  }
}

// Why: one row-level summary; the detail page still shows each entry separately.
function openMetadataSummary(detection: MarketplaceDetection): MarketplaceBadgeState {
  const entries = MARKETPLACE_MCP_AGENTS.flatMap((agent) => {
    const { reader, writer } = detection.openMetadata.agents[agent]
    return [reader, writer]
  })
  if (entries.includes('unreadable')) {
    return 'unreadable'
  }
  if (entries.every((entry) => entry === 'set')) {
    return 'set'
  }
  return entries.includes('set') ? 'partly-set' : 'not-set'
}
