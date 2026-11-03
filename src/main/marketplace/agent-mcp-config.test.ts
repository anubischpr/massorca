import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mcpEntryState,
  readAgentMcpServerNames,
  withClaudeEngramMcp,
  withCodexEngramMcp,
  writeAgentEngramMcp
} from './agent-mcp-config'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'marketplace-mcp-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('readAgentMcpServerNames', () => {
  it('reads Claude server names without their values', () => {
    const path = join(dir, '.claude.json')
    writeFileSync(path, JSON.stringify({ mcpServers: { engram: { env: { TOKEN: 'x' } } } }))
    const read = readAgentMcpServerNames('claude', path)
    expect(read).toEqual({ kind: 'present', names: new Set(['engram']) })
    expect(mcpEntryState(read, 'engram')).toBe('set')
    expect(mcpEntryState(read, 'openmetadata')).toBe('missing')
  })

  it('reads Codex table and dotted entries', () => {
    const path = join(dir, 'config.toml')
    writeFileSync(
      path,
      '[mcp_servers.openmetadata]\ncommand = "python"\n\n[mcp_servers]\n"openmetadata-escritura".command = "python"\n'
    )
    const read = readAgentMcpServerNames('codex', path)
    expect(mcpEntryState(read, 'openmetadata')).toBe('set')
    expect(mcpEntryState(read, 'openmetadata-escritura')).toBe('set')
    expect(mcpEntryState(read, 'engram')).toBe('missing')
  })

  it('treats a missing file as missing and broken JSON as unreadable', () => {
    expect(mcpEntryState(readAgentMcpServerNames('claude', join(dir, 'none')), 'engram')).toBe(
      'missing'
    )
    const path = join(dir, '.claude.json')
    writeFileSync(path, '{not json')
    expect(mcpEntryState(readAgentMcpServerNames('claude', path), 'engram')).toBe('unreadable')
  })
})

describe('withClaudeEngramMcp', () => {
  it('adds and removes only the engram entry, keeping other keys', () => {
    const original = `${JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'x' } } }, null, 2)}\n`
    const added = withClaudeEngramMcp(original, true)
    expect(JSON.parse(added ?? '')).toEqual({
      theme: 'dark',
      mcpServers: {
        other: { command: 'x' },
        engram: { type: 'stdio', command: 'engram', args: ['mcp'], env: {} }
      }
    })
    expect(added?.endsWith('\n')).toBe(true)
    expect(JSON.parse(withClaudeEngramMcp(added, false) ?? '')).toEqual(JSON.parse(original))
  })

  it('returns the same text when nothing changes and null for an unknown shape', () => {
    const text = '{"mcpServers":{}}'
    expect(withClaudeEngramMcp(text, false)).toBe(text)
    expect(withClaudeEngramMcp('{"mcpServers":[]}', true)).toBeNull()
    expect(withClaudeEngramMcp('[]', true)).toBeNull()
  })
})

describe('withCodexEngramMcp', () => {
  it('appends a table and removes it with its subtables, leaving the rest byte-identical', () => {
    const original = 'model = "gpt"\n\n[mcp_servers.other]\ncommand = "x"\n'
    const added = withCodexEngramMcp(original, true)
    expect(added).toBe(
      `${original}\n[mcp_servers.engram]\ncommand = "engram"\nargs = ["mcp", "--tools=agent"]\n`
    )
    const withEnv = `${added}\n[mcp_servers.engram.env]\nENGRAM_CLOUD_AUTOSYNC = "1"\n\n[profiles.x]\nmodel = "y"\n`
    expect(withCodexEngramMcp(withEnv, false)).toBe(`${original}\n[profiles.x]\nmodel = "y"\n`)
  })

  it('keeps CRLF line endings', () => {
    const added = withCodexEngramMcp('model = "gpt"\r\n', true)
    expect(added).toBe(
      'model = "gpt"\r\n\r\n[mcp_servers.engram]\r\ncommand = "engram"\r\nargs = ["mcp", "--tools=agent"]\r\n'
    )
  })

  it.each([
    ['CRLF', 'model = "gpt"\r\n\r\n[mcp_servers.other]\r\ncommand = "x"\r\n'],
    ['no final newline', '[mcp_servers.other]\ncommand = "x"'],
    ['CRLF without final newline', '[mcp_servers.other]\r\ncommand = "x"'],
    ['empty', ''],
    ['ending in a blank line', 'model = "gpt"\n\n']
  ])('round-trips a %s file byte for byte across repeated toggles', (_label, original) => {
    let text = original
    for (let cycle = 0; cycle < 3; cycle++) {
      text = withCodexEngramMcp(withCodexEngramMcp(text, true), false) ?? 'refused'
    }
    expect(text).toBe(original)
  })

  it('keeps comments that sit above the next table when removing engram', () => {
    const source =
      'model = "gpt"\n\n[mcp_servers.engram]\ncommand = "engram"\n# OpenMetadata reader\n[mcp_servers.openmetadata]\ncommand = "om"\n'
    expect(withCodexEngramMcp(source, false)).toBe(
      'model = "gpt"\n# OpenMetadata reader\n[mcp_servers.openmetadata]\ncommand = "om"\n'
    )
  })

  it('removes a comment that sits inside the engram table', () => {
    const source =
      '[mcp_servers.engram]\n# memory\ncommand = "engram"\n\n[profiles.x]\nmodel = "y"\n'
    expect(withCodexEngramMcp(source, false)).toBe('\n[profiles.x]\nmodel = "y"\n')
  })

  it('refuses shapes it cannot edit safely', () => {
    expect(withCodexEngramMcp('mcp_servers = { other = { command = "x" } }\n', true)).toBeNull()
    expect(withCodexEngramMcp('[mcp_servers]\nengram.command = "engram"\n', false)).toBeNull()
  })
})

describe('writeAgentEngramMcp', () => {
  it('writes Claude config and keeps a backup of the previous file', () => {
    const path = join(dir, '.claude.json')
    writeFileSync(path, '{"theme":"dark"}')
    expect(writeAgentEngramMcp('claude', path, true)).toEqual({ ok: true, state: 'set' })
    expect(readFileSync(`${path}.massorca-backup`, 'utf8')).toBe('{"theme":"dark"}')
    expect(mcpEntryState(readAgentMcpServerNames('claude', path), 'engram')).toBe('set')
    expect(writeAgentEngramMcp('claude', path, false)).toEqual({ ok: true, state: 'missing' })
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ theme: 'dark', mcpServers: {} })
  })

  it('writes Codex config with a backup and creates a missing file', () => {
    const path = join(dir, 'codex', 'config.toml')
    expect(writeAgentEngramMcp('codex', path, true)).toEqual({ ok: true, state: 'set' })
    expect(mcpEntryState(readAgentMcpServerNames('codex', path), 'engram')).toBe('set')
    expect(writeAgentEngramMcp('codex', path, false)).toEqual({ ok: true, state: 'missing' })
    expect(existsSync(`${path}.bak`)).toBe(true)
  })

  it('does not write when the shape is unknown', () => {
    const path = join(dir, '.claude.json')
    writeFileSync(path, '{"mcpServers":"x"}')
    expect(writeAgentEngramMcp('claude', path, true)).toEqual({
      ok: false,
      reason: 'unsupported-shape'
    })
    expect(readFileSync(path, 'utf8')).toBe('{"mcpServers":"x"}')
    expect(existsSync(`${path}.massorca-backup`)).toBe(false)
  })
})
