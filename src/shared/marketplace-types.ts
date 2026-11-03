/** Agents whose own config files the Marketplace reads and, for Engram, edits. */
export const MARKETPLACE_MCP_AGENTS = ['claude', 'codex'] as const
export type MarketplaceMcpAgent = (typeof MARKETPLACE_MCP_AGENTS)[number]

/** Whether one named MCP server entry exists in an agent's config. Names only, never values. */
export type MarketplaceMcpEntryState = 'set' | 'missing' | 'unreadable'

export type MarketplaceDetection = {
  engram: {
    cli: 'found' | 'missing'
    store: 'found' | 'missing'
    agents: Record<MarketplaceMcpAgent, MarketplaceMcpEntryState>
  }
  openMetadata: {
    agents: Record<
      MarketplaceMcpAgent,
      { reader: MarketplaceMcpEntryState; writer: MarketplaceMcpEntryState }
    >
  }
}

export type MarketplaceSetEngramMcpArgs = { agent: MarketplaceMcpAgent; enabled: boolean }

export type MarketplaceSetEngramMcpResult =
  | { ok: true; state: MarketplaceMcpEntryState }
  | { ok: false; reason: 'unreadable' | 'unsupported-shape' | 'changed-while-writing' }

export type MarketplaceApi = {
  detect: () => Promise<MarketplaceDetection>
  setEngramMcp: (args: MarketplaceSetEngramMcpArgs) => Promise<MarketplaceSetEngramMcpResult>
}
