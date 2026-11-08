import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'
import type {
  MarketplaceMcpAgent,
  MarketplaceMcpEntryState,
  MarketplaceSetEngramMcpResult
} from '../../shared/marketplace-types'
import { ClaudeRuntimePathResolver } from '../claude-accounts/runtime-paths'
import { writeTomlConfigAtomically } from '../codex/config-toml-atomic-write'
import { readMcpServerTomlOwnership } from '../codex/config-toml-mcp-servers'
import { getSystemCodexHomePath } from '../codex/codex-home-paths'
import { writeFileAtomicallyIfUnchanged } from '../codex-accounts/fs-utils'
import { writeRollingFileBackup } from '../rolling-file-backup'
import { withCodexMcpEntry } from './codex-mcp-entry-edit'
import { editJsonContainerMember, parseJsonObject } from './json-member-edit'
import { resolveWriteTarget } from './marketplace-agent-paths'
import { keepFirstOriginal } from './marketplace-file-original-backup'

export const ENGRAM_MCP_NAME = 'engram'
export const OPENMETADATA_READER_MCP_NAME = 'openmetadata'
export const OPENMETADATA_WRITER_MCP_NAME = 'openmetadata-escritura'

export type AgentMcpNamesRead =
  | { kind: 'present'; names: ReadonlySet<string> }
  | { kind: 'absent' }
  | { kind: 'unavailable' }

export type ConfigTextRead =
  | { kind: 'present'; text: string }
  | { kind: 'absent' }
  | { kind: 'unavailable' }

/** The user-scope config file each agent reads its MCP servers from on this computer. */
export function resolveAgentMcpConfigPath(agent: MarketplaceMcpAgent): string {
  return agent === 'claude'
    ? new ClaudeRuntimePathResolver().getRuntimePaths().configPath
    : join(getSystemCodexHomePath(), 'config.toml')
}

export function readConfigText(path: string): ConfigTextRead {
  try {
    return { kind: 'present', text: readFileSync(path, 'utf8') }
  } catch (error) {
    return isDefinitiveAbsence(error) ? { kind: 'absent' } : { kind: 'unavailable' }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function claudeMcpServerNames(text: string): ReadonlySet<string> | null {
  // Why: an empty file holds no servers; it is not an unknown shape.
  if (text.trim() === '') {
    return new Set()
  }
  const config = parseJsonObject(text)
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

const ENGRAM_CLAUDE_ENTRY = { type: 'stdio', command: 'engram', args: ['mcp'], env: {} }

/** Returns the edited JSON, the same text when nothing changes, or null when the shape is unknown. */
export function withClaudeEngramMcp(text: string | null, enabled: boolean): string | null {
  const names = text === null ? new Set<string>() : claudeMcpServerNames(text)
  if (!names) {
    return null
  }
  // Why: an engram entry the user wrote themselves is theirs; only a missing one is added.
  if (enabled && names.has(ENGRAM_MCP_NAME)) {
    return text ?? ''
  }
  return editJsonContainerMember(
    text,
    'mcpServers',
    ENGRAM_MCP_NAME,
    enabled ? ENGRAM_CLAUDE_ENTRY : undefined
  )
}

const ENGRAM_CODEX_BODY = ['command = "engram"', 'args = ["mcp", "--tools=agent"]']

/** Same contract as withClaudeEngramMcp, editing Codex config.toml byte-preservingly. */
export function withCodexEngramMcp(text: string | null, enabled: boolean): string | null {
  return withCodexMcpEntry(text, ENGRAM_MCP_NAME, enabled ? ENGRAM_CODEX_BODY : null)
}

const CLAUDE_WRITE_ATTEMPTS = 3

/**
 * Adds or removes the engram MCP server in the agent's own config, backing the file up first.
 * A file that a link leads out of `home` is left alone.
 */
export function writeAgentEngramMcp(
  agent: MarketplaceMcpAgent,
  path: string,
  enabled: boolean,
  home: string = homedir()
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
    const target = resolveWriteTarget(path, home)
    if (target === null) {
      // Why: the shared result type has no reason of its own for this; the file was not usable.
      return { ok: false, reason: 'unreadable' }
    }
    if (agent === 'codex') {
      if (current !== null) {
        keepFirstOriginal(target)
      }
      writeTomlConfigAtomically(path, next)
      return { ok: true, state: enabled ? 'set' : 'missing' }
    }
    const mode = existsSync(target) ? statSync(target).mode : 0o600
    if (current !== null) {
      keepFirstOriginal(target)
      writeRollingFileBackup(target, `${target}.massorca-backup`)
    }
    if (writeFileAtomicallyIfUnchanged(target, current, next, { mode })) {
      return { ok: true, state: enabled ? 'set' : 'missing' }
    }
  }
  return { ok: false, reason: 'changed-while-writing' }
}
