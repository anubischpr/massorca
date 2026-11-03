import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import type {
  MarketplaceMcpAgent,
  MarketplaceMcpEntryState,
  MarketplaceSetEngramMcpResult
} from '../../shared/marketplace-types'
import { ClaudeRuntimePathResolver } from '../claude-accounts/runtime-paths'
import { writeTomlConfigAtomically } from '../codex/config-toml-atomic-write'
import { parseTomlKeyPath, parseTomlTableHeaderPath } from '../codex/config-toml-key-path'
import {
  createTomlLineScanState,
  getTomlTableHeader,
  isTomlStructuralLine,
  joinPreservingTrailingNewline,
  updateTomlLineScanState
} from '../codex/config-toml-line-scan'
import { readMcpServerTomlOwnership } from '../codex/config-toml-mcp-servers'
import { getSystemCodexHomePath } from '../codex/codex-home-paths'
import { writeFileAtomicallyIfUnchanged } from '../codex-accounts/fs-utils'
import { writeRollingFileBackup } from '../rolling-file-backup'

export const ENGRAM_MCP_NAME = 'engram'
export const OPENMETADATA_READER_MCP_NAME = 'openmetadata'
export const OPENMETADATA_WRITER_MCP_NAME = 'openmetadata-escritura'

export type AgentMcpNamesRead =
  | { kind: 'present'; names: ReadonlySet<string> }
  | { kind: 'absent' }
  | { kind: 'unavailable' }

type ConfigTextRead =
  | { kind: 'present'; text: string }
  | { kind: 'absent' }
  | { kind: 'unavailable' }

/** The user-scope config file each agent reads its MCP servers from on this computer. */
export function resolveAgentMcpConfigPath(agent: MarketplaceMcpAgent): string {
  return agent === 'claude'
    ? new ClaudeRuntimePathResolver().getRuntimePaths().configPath
    : join(getSystemCodexHomePath(), 'config.toml')
}

function readConfigText(path: string): ConfigTextRead {
  try {
    return { kind: 'present', text: readFileSync(path, 'utf8') }
  } catch (error) {
    return isDefinitiveAbsence(error) ? { kind: 'absent' } : { kind: 'unavailable' }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseClaudeConfig(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return isPlainObject(value) ? value : null
  } catch {
    return null
  }
}

function claudeMcpServerNames(text: string): ReadonlySet<string> | null {
  const config = parseClaudeConfig(text)
  if (!config) {
    return null
  }
  const servers = config.mcpServers
  if (servers === undefined) {
    return new Set()
  }
  return isPlainObject(servers) ? new Set(Object.keys(servers)) : null
}

export function readAgentMcpServerNames(
  agent: MarketplaceMcpAgent,
  path: string
): AgentMcpNamesRead {
  const read = readConfigText(path)
  if (read.kind !== 'present') {
    return read
  }
  const names =
    agent === 'claude'
      ? claudeMcpServerNames(read.text)
      : readMcpServerTomlOwnership(read.text).names
  return names ? { kind: 'present', names } : { kind: 'unavailable' }
}

export function mcpEntryState(read: AgentMcpNamesRead, name: string): MarketplaceMcpEntryState {
  if (read.kind === 'unavailable') {
    return 'unreadable'
  }
  return read.kind === 'present' && read.names.has(name) ? 'set' : 'missing'
}

/** Returns the edited JSON, the same text when nothing changes, or null when the shape is unknown. */
export function withClaudeEngramMcp(text: string | null, enabled: boolean): string | null {
  const config = text === null ? {} : parseClaudeConfig(text)
  if (!config || (config.mcpServers !== undefined && !isPlainObject(config.mcpServers))) {
    return null
  }
  const servers: Record<string, unknown> = isPlainObject(config.mcpServers)
    ? { ...config.mcpServers }
    : {}
  if (enabled === ENGRAM_MCP_NAME in servers) {
    return text ?? ''
  }
  if (enabled) {
    servers[ENGRAM_MCP_NAME] = { type: 'stdio', command: 'engram', args: ['mcp'], env: {} }
  } else {
    delete servers[ENGRAM_MCP_NAME]
  }
  const rendered = JSON.stringify({ ...config, mcpServers: servers }, null, 2)
  return text?.endsWith('\n') ? `${rendered}\n` : rendered
}

/** Same contract as withClaudeEngramMcp, editing Codex config.toml byte-preservingly. */
export function withCodexEngramMcp(text: string | null, enabled: boolean): string | null {
  const source = text ?? ''
  const usesCrlf = source.includes('\r\n')
  const { names, ownsRoot } = readMcpServerTomlOwnership(source)
  if (ownsRoot) {
    return null
  }
  if (enabled) {
    if (names.has(ENGRAM_MCP_NAME)) {
      return source
    }
    const eol = usesCrlf ? '\r\n' : '\n'
    const block = ['[mcp_servers.engram]', 'command = "engram"', 'args = ["mcp", "--tools=agent"]']
    const prefix = source.length === 0 ? '' : source.endsWith('\n') ? eol : `${eol}${eol}`
    return `${source}${prefix}${block.join(eol)}${eol}`
  }
  if (!names.has(ENGRAM_MCP_NAME)) {
    return source
  }
  const kept: string[] = []
  let tablePath: string[] | null = []
  let skipping = false
  let state = createTomlLineScanState()
  for (const line of source.split('\n')) {
    if (isTomlStructuralLine(state)) {
      const header = getTomlTableHeader(line)
      if (header) {
        tablePath = parseTomlTableHeaderPath(header)?.segments ?? null
        skipping = tablePath?.[0] === 'mcp_servers' && tablePath[1] === ENGRAM_MCP_NAME
      } else if (!skipping) {
        const key = parseTomlKeyPath(line)
        const path =
          tablePath && key && line[key.end] === '=' ? [...tablePath, ...key.segments] : []
        // Why: a dotted or inline engram entry cannot be cut by table without guessing its extent.
        if (path[0] === 'mcp_servers' && path[1] === ENGRAM_MCP_NAME) {
          return null
        }
      }
    }
    state = updateTomlLineScanState(state, line)
    if (!skipping) {
      kept.push(line)
    }
  }
  return joinPreservingTrailingNewline(kept, usesCrlf)
}

const CLAUDE_WRITE_ATTEMPTS = 3

/** Adds or removes the engram MCP server in the agent's own config, backing the file up first. */
export function writeAgentEngramMcp(
  agent: MarketplaceMcpAgent,
  path: string,
  enabled: boolean
): MarketplaceSetEngramMcpResult {
  // Why: Claude rewrites .claude.json while it runs, so the write only lands on the bytes it read.
  for (let attempt = 0; attempt < (agent === 'claude' ? CLAUDE_WRITE_ATTEMPTS : 1); attempt++) {
    const read = readConfigText(path)
    if (read.kind === 'unavailable') {
      return { ok: false, reason: 'unreadable' }
    }
    const current = read.kind === 'present' ? read.text : null
    const next =
      agent === 'claude'
        ? withClaudeEngramMcp(current, enabled)
        : withCodexEngramMcp(current, enabled)
    if (next === null) {
      return { ok: false, reason: 'unsupported-shape' }
    }
    if (next === (current ?? '')) {
      return { ok: true, state: enabled ? 'set' : 'missing' }
    }
    if (agent === 'codex') {
      writeTomlConfigAtomically(path, next)
      return { ok: true, state: enabled ? 'set' : 'missing' }
    }
    const mode = existsSync(path) ? statSync(path).mode : 0o600
    if (current !== null) {
      writeRollingFileBackup(path, `${path}.massorca-backup`)
    }
    if (writeFileAtomicallyIfUnchanged(path, current, next, { mode })) {
      return { ok: true, state: enabled ? 'set' : 'missing' }
    }
  }
  return { ok: false, reason: 'changed-while-writing' }
}
