import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { MarketplaceDetection, MarketplaceMcpAgent } from '../../shared/marketplace-types'
import { isCommandOnPath } from '../ipc/preflight-command-exec'
import {
  ENGRAM_MCP_NAME,
  OPENMETADATA_READER_MCP_NAME,
  OPENMETADATA_WRITER_MCP_NAME,
  mcpEntryState,
  readAgentMcpServerNames,
  resolveAgentMcpConfigPath,
  type AgentMcpNamesRead
} from './agent-mcp-config'

/** Engram keeps memories in ENGRAM_DATA_DIR, else ~/.engram. */
export function resolveEngramStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return env.ENGRAM_DATA_DIR?.trim() || join(homedir(), '.engram')
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export type MarketplaceDetectionDeps = {
  commandOnPath: (command: string) => Promise<boolean>
  storePath: () => string
  configPath: (agent: MarketplaceMcpAgent) => string
}

const defaultDeps: MarketplaceDetectionDeps = {
  commandOnPath: (command) => isCommandOnPath(command),
  storePath: () => resolveEngramStorePath(),
  configPath: resolveAgentMcpConfigPath
}

/** This computer only; reads config entry names, never their values. */
export async function detectMarketplaceItems(
  deps: MarketplaceDetectionDeps = defaultDeps
): Promise<MarketplaceDetection> {
  const read = (agent: MarketplaceMcpAgent): AgentMcpNamesRead =>
    readAgentMcpServerNames(agent, deps.configPath(agent))
  const reads = { claude: read('claude'), codex: read('codex') }
  const perAgent = <T>(pick: (names: AgentMcpNamesRead) => T): Record<MarketplaceMcpAgent, T> => ({
    claude: pick(reads.claude),
    codex: pick(reads.codex)
  })
  return {
    engram: {
      cli: (await deps.commandOnPath('engram')) ? 'found' : 'missing',
      store: isDirectory(deps.storePath()) ? 'found' : 'missing',
      agents: perAgent((read) => mcpEntryState(read, ENGRAM_MCP_NAME))
    },
    openMetadata: {
      agents: perAgent((read) => ({
        reader: mcpEntryState(read, OPENMETADATA_READER_MCP_NAME),
        writer: mcpEntryState(read, OPENMETADATA_WRITER_MCP_NAME)
      }))
    }
  }
}
