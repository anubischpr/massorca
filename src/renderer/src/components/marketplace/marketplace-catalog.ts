import type { MarketplaceMcpAgent } from '../../../../shared/marketplace-types'

export type MarketplaceItemId = 'git' | 'github' | 'engram' | 'openmetadata'
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
      fallback: 'Version control for your repositories.'
    }
  },
  {
    id: 'github',
    kind: 'service',
    name: 'GitHub',
    description: {
      key: 'auto.components.marketplace.marketplace-catalog.githubDescription',
      fallback: 'Pull requests and issues from GitHub, through the gh command.'
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
      fallback: "Your company's context center, as an MCP server for your agents."
    }
  }
]

export const MARKETPLACE_AGENT_LABELS: Record<MarketplaceMcpAgent, string> = {
  claude: 'Claude Code',
  codex: 'Codex'
}

// Why: the same install pages the existing setup checks already link to.
export const GIT_DOWNLOADS_URL = 'https://git-scm.com/downloads'
export const GITHUB_CLI_URL = 'https://cli.github.com'
