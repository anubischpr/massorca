import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { readMcpServerTomlOwnership } from '../codex/config-toml-mcp-servers'
import { readConfigText, type AgentMcpNamesRead } from './agent-mcp-config'
import { editTextFileWithBackup } from './agent-file-write'
import { withCodexMcpEntry } from './codex-mcp-entry-edit'
import { editJsonContainerMember, parseJsonObject } from './json-member-edit'
import { isAgentPresent, type MarketplaceAgentPaths } from './marketplace-agent-paths'

export type McpEntryEdit =
  | {
      action: 'set'
      name: string
      json: Record<string, unknown>
      codexBody: readonly string[]
      /** MassOrca wrote this entry earlier, so it may be rewritten. */
      owned: boolean
    }
  | { action: 'remove'; name: string }

export type McpEntryOutcome =
  | 'added'
  | 'updated'
  | 'unchanged'
  | 'removed'
  | 'absent'
  /** The user's own entry with this name; left as it is. */
  | 'left-existing'
  /** Gentle Shell already ships this entry; never added or removed. */
  | 'built-in'

export type McpBatchResult =
  | { ok: true; outcomes: Record<string, McpEntryOutcome>; skipped: 'not-installed' | null }
  | { ok: false; reason: 'unreadable-config' | 'unsupported-shape' | 'failed' }

function jsonContainerKey(agent: MarketplaceAppAgent, text: string | null): string {
  const parsed = text === null ? null : parseJsonObject(text)
  if (agent === 'gentle-shell' && parsed && !('mcpServers' in parsed) && 'servers' in parsed) {
    return 'servers'
  }
  return 'mcpServers'
}

function jsonNames(text: string): ReadonlySet<string> | null {
  const parsed = parseJsonObject(text)
  if (!parsed) {
    return null
  }
  const names = new Set<string>()
  for (const key of ['mcpServers', 'servers']) {
    const container = parsed[key]
    if (container === undefined) {
      continue
    }
    if (typeof container !== 'object' || container === null || Array.isArray(container)) {
      return null
    }
    Object.keys(container).forEach((name) => names.add(name))
  }
  return names
}

function entryNames(agent: MarketplaceAppAgent, text: string): ReadonlySet<string> | null {
  return agent === 'codex' ? readMcpServerTomlOwnership(text).names : jsonNames(text)
}

/** Entry names in an agent's own MCP config; names only, never their values. */
export function readAgentEntryNames(agent: MarketplaceAppAgent, path: string): AgentMcpNamesRead {
  const read = readConfigText(path)
  if (read.kind !== 'present') {
    return read
  }
  const names = entryNames(agent, read.text)
  return names ? { kind: 'present', names } : { kind: 'unavailable' }
}

function codexTable(name: string, body: readonly string[], eol: string): string {
  return [`[mcp_servers.${name}]`, ...body].join(eol)
}

function removeEntry(agent: MarketplaceAppAgent, text: string | null, name: string): string | null {
  return agent === 'codex'
    ? withCodexMcpEntry(text, name, null)
    : editJsonContainerMember(text, jsonContainerKey(agent, text), name, undefined)
}

function setEntry(
  agent: MarketplaceAppAgent,
  text: string | null,
  edit: Extract<McpEntryEdit, { action: 'set' }>
): string | null {
  if (agent !== 'codex') {
    return editJsonContainerMember(text, jsonContainerKey(agent, text), edit.name, edit.json)
  }
  const eol = text?.includes('\r\n') ? '\r\n' : '\n'
  if (text?.includes(codexTable(edit.name, edit.codexBody, eol))) {
    return text
  }
  // Why: rewriting an entry MassOrca owns moves its table to the end of the file.
  const removed = withCodexMcpEntry(text, edit.name, null)
  return removed === null ? null : withCodexMcpEntry(removed, edit.name, edit.codexBody)
}

function applyEdits(
  agent: MarketplaceAppAgent,
  edits: readonly McpEntryEdit[],
  outcomes: Record<string, McpEntryOutcome>
): (current: string | null) => string | null {
  return (current) => {
    const names = current === null ? new Set<string>() : entryNames(agent, current)
    if (!names) {
      return null
    }
    let text = current
    for (const edit of edits) {
      const exists = names.has(edit.name)
      if (edit.action === 'remove') {
        outcomes[edit.name] = exists ? 'removed' : 'absent'
        text = exists ? removeEntry(agent, text, edit.name) : text
      } else if (exists && !edit.owned) {
        outcomes[edit.name] = agent === 'gentle-shell' ? 'built-in' : 'left-existing'
      } else if (exists) {
        const next = setEntry(agent, text, edit)
        outcomes[edit.name] = next === text ? 'unchanged' : 'updated'
        text = next
      } else {
        outcomes[edit.name] = 'added'
        text = setEntry(agent, text, edit)
      }
      if (text === null) {
        return null
      }
    }
    return text
  }
}

/** Applies every edit to one agent's MCP config in a single read, backup and write. */
export function applyAgentMcpEdits(
  agent: MarketplaceAppAgent,
  paths: MarketplaceAgentPaths,
  edits: readonly McpEntryEdit[]
): McpBatchResult {
  const path = paths.mcpConfig(agent)
  if (!isAgentPresent(agent, paths)) {
    return { ok: true, outcomes: {}, skipped: 'not-installed' }
  }
  const outcomes: Record<string, McpEntryOutcome> = {}
  const result = editTextFileWithBackup(
    path,
    applyEdits(agent, edits, outcomes),
    agent === 'codex' ? 'toml' : 'text'
  )
  return result.kind === 'failed'
    ? { ok: false, reason: result.reason }
    : { ok: true, outcomes, skipped: null }
}
