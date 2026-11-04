import { parseTomlKeyPath, parseTomlTableHeaderPath } from '../codex/config-toml-key-path'
import {
  createTomlLineScanState,
  getTomlTableHeader,
  isTomlStructuralLine,
  updateTomlLineScanState
} from '../codex/config-toml-line-scan'
import { readMcpServerTomlOwnership } from '../codex/config-toml-mcp-servers'

function tomlKey(name: string): string {
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name)
}

/** A TOML basic string; JSON string escapes are valid TOML escapes. */
export function tomlString(value: string): string {
  return JSON.stringify(value)
}

function appendTable(source: string, name: string, body: readonly string[]): string {
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const block = [`[mcp_servers.${tomlKey(name)}]`, ...body]
  if (source.length === 0) {
    return `${block.join(eol)}${eol}`
  }
  // Why: one blank separator line and the file's own final-newline choice, so removal restores it.
  return source.endsWith('\n')
    ? `${source}${eol}${block.join(eol)}${eol}`
    : `${source}${eol}${eol}${block.join(eol)}`
}

function removeTable(source: string, name: string): string | null {
  const lines = source.split('\n')
  const dropped = new Set<number>()
  let tablePath: string[] | null = []
  let skipping = false
  // Blank or comment lines inside the span; dropped only if more of the entry follows.
  let pending: number[] = []
  let previousStructuralBlank = false
  let state = createTomlLineScanState()
  for (const [index, line] of lines.entries()) {
    const structural = isTomlStructuralLine(state)
    const header = structural ? getTomlTableHeader(line) : null
    if (header) {
      tablePath = parseTomlTableHeaderPath(header)?.segments ?? null
      const startsEntry = tablePath?.[0] === 'mcp_servers' && tablePath[1] === name
      if (startsEntry && !skipping && previousStructuralBlank) {
        dropped.add(index - 1)
      }
      if (startsEntry) {
        pending.forEach((pendingIndex) => dropped.add(pendingIndex))
        dropped.add(index)
      }
      pending = []
      skipping = startsEntry
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
      // Why: a dotted or inline entry cannot be cut by table without guessing its extent.
      if (path[0] === 'mcp_servers' && path[1] === name) {
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

/**
 * Adds `[mcp_servers.<name>]` with the given body lines, or (body null) removes the table and its
 * subtables, leaving every other byte of config.toml as it was. Returns the same text when nothing
 * changes and null when the shape cannot be edited safely.
 */
export function withCodexMcpEntry(
  text: string | null,
  name: string,
  body: readonly string[] | null
): string | null {
  const source = text ?? ''
  const { names, ownsRoot } = readMcpServerTomlOwnership(source)
  if (ownsRoot) {
    return null
  }
  if (body) {
    return names.has(name) ? source : appendTable(source, name, body)
  }
  return names.has(name) ? removeTable(source, name) : source
}
