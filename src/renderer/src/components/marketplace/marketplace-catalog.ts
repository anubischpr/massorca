import { getAgentLabel } from '@/lib/agent-catalog'
import { piRuntimeLabel } from '@/lib/pi-agent-display'
import type { MarketplaceItemId } from '@/store/slices/ui/ui-slice-contract-core'
import type { MarketplaceAppAgent } from '../../../../shared/marketplace-apps'

export type { MarketplaceItemId }
export type MarketplaceItemKind = 'tool' | 'service'

export type MarketplaceCatalogItem = {
  id: MarketplaceItemId
  kind: MarketplaceItemKind
  name: string
  // Why: a key plus English fallback, so descriptions translate at render time rather than at import.
  description: { key: string; fallback: string }
}

export const MARKETPLACE_CATALOG: readonly MarketplaceCatalogItem[] = [
  {
    id: 'git',
    kind: 'tool',
    name: 'Git',
    description: {
      key: 'auto.components.marketplace.marketplace-catalog.gitDescription',
      fallback: 'Versions of files and code. Workspaces and Versions use it.'
    }
  },
  {
    id: 'github',
    kind: 'service',
    name: 'GitHub',
    description: {
      key: 'auto.components.marketplace.marketplace-catalog.githubDescription',
      fallback: 'Repositories, pull requests and issues.'
    }
  },
  {
    id: 'engram',
    kind: 'tool',
    name: 'Engram',
    description: {
      key: 'auto.components.marketplace.marketplace-catalog.engramDescription',
      fallback: 'Memory your agents keep between sessions.'
    }
  },
  {
    id: 'openmetadata',
    kind: 'service',
    name: 'OpenMetadata',
    description: {
      key: 'auto.components.marketplace.marketplace-catalog.openMetadataDescription',
      fallback: 'Company context for agents, over MCP.'
    }
  }
]

/** The name an agent goes by in the Marketplace; Gentle Shell is never called Pi. */
export function marketplaceAgentLabel(agent: MarketplaceAppAgent): string {
  return agent === 'gentle-shell' ? piRuntimeLabel('gentle-shell') : getAgentLabel(agent)
}

// Why: the same install pages the existing setup checks already link to.
export const GIT_DOWNLOADS_URL = 'https://git-scm.com/downloads'
export const GITHUB_CLI_URL = 'https://cli.github.com'
