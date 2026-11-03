import { ipcMain } from 'electron'
import {
  MARKETPLACE_MCP_AGENTS,
  type MarketplaceSetEngramMcpArgs,
  type MarketplaceSetEngramMcpResult
} from '../../shared/marketplace-types'
import { resolveAgentMcpConfigPath, writeAgentEngramMcp } from '../marketplace/agent-mcp-config'
import { detectMarketplaceItems } from '../marketplace/marketplace-detection'

function isSetEngramMcpArgs(value: unknown): value is MarketplaceSetEngramMcpArgs {
  if (typeof value !== 'object' || value === null || !('agent' in value) || !('enabled' in value)) {
    return false
  }
  return (
    MARKETPLACE_MCP_AGENTS.some((known) => known === value.agent) &&
    typeof value.enabled === 'boolean'
  )
}

export function registerMarketplaceHandlers(): void {
  ipcMain.handle('marketplace:detect', () => detectMarketplaceItems())
  ipcMain.handle(
    'marketplace:setEngramMcp',
    (_event, args: unknown): MarketplaceSetEngramMcpResult => {
      if (!isSetEngramMcpArgs(args)) {
        throw new Error('Invalid marketplace:setEngramMcp arguments')
      }
      return writeAgentEngramMcp(args.agent, resolveAgentMcpConfigPath(args.agent), args.enabled)
    }
  )
}
