import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { tomlString } from './codex-mcp-entry-edit'

export const ENGRAM_ENTRY_NAME = 'engram'
export const OPENMETADATA_ENTRY_NAME = 'openmetadata'
export const GITHUB_ENTRY_NAME = 'github'

/**
 * Antigravity and Gentle Shell cannot expand a header from the environment, so they reach the
 * server through this stdio bridge. Pinned so a new release cannot change what runs unasked.
 */
export const MCP_REMOTE_PACKAGE = 'mcp-remote@0.1.29'

export type McpEntrySpec = { json: Record<string, unknown>; codexBody: readonly string[] }

export function engramEntrySpec(agent: MarketplaceAppAgent): McpEntrySpec {
  return {
    json:
      agent === 'claude'
        ? { type: 'stdio', command: 'engram', args: ['mcp'], env: {} }
        : { command: 'engram', args: ['mcp'] },
    codexBody: ['command = "engram"', 'args = ["mcp", "--tools=agent"]']
  }
}

/** The standard connection: the server address, with the token named by an env var, never inlined. */
export function openMetadataEntrySpec(
  agent: MarketplaceAppAgent,
  url: string,
  tokenEnv: string
): McpEntrySpec {
  const codexBody = [`url = ${tomlString(url)}`, `bearer_token_env_var = ${tomlString(tokenEnv)}`]
  if (agent === 'claude') {
    return {
      json: { type: 'http', url, headers: { Authorization: `Bearer \${${tokenEnv}}` } },
      codexBody
    }
  }
  return {
    json: {
      command: 'npx',
      args: ['-y', MCP_REMOTE_PACKAGE, url, '--header', `Authorization:Bearer \${${tokenEnv}}`],
      env: { [tokenEnv]: `$${tokenEnv}` }
    },
    codexBody
  }
}
