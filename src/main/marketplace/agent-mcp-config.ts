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
    if (source.length === 0) {
      return `${block.join(eol)}${eol}`
    }
    // Why: one blank separator line and the file's own final-newline choice, so removal restores it.
    return source.endsWith('\n')
      ? `${source}${eol}${block.join(eol)}${eol}`
      : `${source}${eol}${eol}${block.join(eol)}`
  }
  if (!names.has(ENGRAM_MCP_NAME)) {
    return source
  }
  const lines = source.split('\n')
  const dropped = new Set<number>()
  let tablePath: string[] | null = []
  let skipping = false
  // Blank or comment lines inside the span; dropped only if more engram content follows.
  let pending: number[] = []
  let previousStructuralBlank = false
  let state = createTomlLineScanState()
  for (const [index, line] of lines.entries()) {
    const structural = isTomlStructuralLine(state)
    const header = structural ? getTomlTableHeader(line) : null
    if (header) {
      tablePath = parseTomlTableHeaderPath(header)?.segments ?? null
      const startsEngram = tablePath?.[0] === 'mcp_servers' && tablePath[1] === ENGRAM_MCP_NAME
      if (startsEngram && !skipping && previousStructuralBlank) {
        dropped.add(index - 1)
      }
      if (startsEngram) {
        pending.forEach((pendingIndex) => dropped.add(pendingIndex))
        dropped.add(index)
      }
      pending = []
      skipping = startsEngram
    } else if (skipping) {
      const trimmed = line.trim()
      if (structural && (trimmed === '' || trimmed.startsWith('#'))) {
        pending.push(index)
      } else {
        pending.forEach((pendingIndex) => dropped.add(pendingIndex))
        pending = []
        dropped.add(index)
      }
    } else if (structural) {
      const key = parseTomlKeyPath(line)
      const path = tablePath && key && line[key.end] === '=' ? [...tablePath, ...key.segments] : []
      // Why: a dotted or inline engram entry cannot be cut by table without guessing its extent.
      if (path[0] === 'mcp_servers' && path[1] === ENGRAM_MCP_NAME) {
        return null
      }
    }
    previousStructuralBlank = structural && line.trim() === ''
    state = updateTomlLineScanState(state, line)
  }
  const result = lines.filter((_, index) => !dropped.has(index)).join('\n')
  // Why: a span cut at the end of a file without a final newline leaves the separator's CR behind.
  return !source.endsWith('\n') && dropped.has(lines.length - 1) && result.endsWith('\r')
    ? result.slice(0, -1)
    : result
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
