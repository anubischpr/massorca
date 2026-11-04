import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyAgentMcpEdits,
  readAgentEntryNames,
  type McpEntryEdit
} from './marketplace-agent-config'
import { applyAgentInstructionsBlock } from './marketplace-agent-instructions'
import { engramEntrySpec, openMetadataEntrySpec } from './marketplace-entry-specs'
import {
  installAllAgents,
  makeTempHome,
  testAgentPaths,
  writeFixture
} from './marketplace-apps-test-fixtures'

let home: string
beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

const engram = (
  agent: 'claude' | 'codex' | 'antigravity' | 'gentle-shell',
  owned = false
): McpEntryEdit => ({
  action: 'set',
  name: 'engram',
  owned,
  ...engramEntrySpec(agent)
})
const removeEngram: McpEntryEdit = { action: 'remove', name: 'engram' }

describe('applyAgentMcpEdits round trips', () => {
  it.each([
    [
      'claude',
      'LF',
      '{\n  "theme": "dark",\n  "mcpServers": {\n    "other": { "command": "x" }\n  }\n}\n'
    ],
    ['claude', 'CRLF', '{\r\n  "mcpServers": {}\r\n}\r\n'],
    ['claude', 'no final newline', '{\n  "theme": "dark",\n  "mcpServers": {}\n}'],
    ['antigravity', 'LF', '{\n  "mcpServers": {\n    "x": { "command": "x" }\n  }\n}\n'],
    ['gentle-shell', 'servers key', '{\n  "servers": {\n    "x": { "command": "x" }\n  }\n}\n'],
    ['gentle-shell', 'mcpServers key', '{\n  "mcpServers": {}\n}\n'],
    [
      'codex',
      'LF with comments',
      '# my config\nmodel = "gpt"\n\n# keep\n[mcp_servers.other]\ncommand = "x"\n'
    ],
    ['codex', 'CRLF', 'model = "gpt"\r\n\r\n[mcp_servers.other]\r\ncommand = "x"\r\n'],
    ['codex', 'no final newline', '[mcp_servers.other]\ncommand = "x"']
  ] as const)('%s adds and removes engram byte for byte (%s)', (agent, _label, original) => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig(agent)
    writeFixture(path, original)
    expect(applyAgentMcpEdits(agent, paths, [engram(agent)])).toMatchObject({
      ok: true,
      outcomes: { engram: 'added' }
    })
    expect(readFileSync(path, 'utf8')).not.toBe(original)
    expect(applyAgentMcpEdits(agent, paths, [removeEngram])).toMatchObject({
      ok: true,
      outcomes: { engram: 'removed' }
    })
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('keeps a backup holding the bytes from before the write', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('claude')
    writeFixture(path, '{"theme":"dark"}')
    applyAgentMcpEdits('claude', paths, [engram('claude')])
    expect(readFileSync(`${path}.massorca-backup`, 'utf8')).toBe('{"theme":"dark"}')
    const codexPath = paths.mcpConfig('codex')
    writeFixture(codexPath, 'model = "gpt"\n')
    applyAgentMcpEdits('codex', paths, [engram('codex')])
    expect(readFileSync(`${codexPath}.bak`, 'utf8')).toBe('model = "gpt"\n')
  })
})

describe('applyAgentMcpEdits entry shapes', () => {
  it('writes the Engram entries each agent expects', () => {
    const paths = testAgentPaths(home)
    for (const agent of ['claude', 'antigravity', 'gentle-shell', 'codex'] as const) {
      applyAgentMcpEdits(agent, paths, [engram(agent)])
    }
    expect(JSON.parse(readFileSync(paths.mcpConfig('claude'), 'utf8'))).toEqual({
      mcpServers: { engram: { type: 'stdio', command: 'engram', args: ['mcp'], env: {} } }
    })
    for (const agent of ['antigravity', 'gentle-shell'] as const) {
      expect(JSON.parse(readFileSync(paths.mcpConfig(agent), 'utf8'))).toEqual({
        mcpServers: { engram: { command: 'engram', args: ['mcp'] } }
      })
    }
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toBe(
      '[mcp_servers.engram]\ncommand = "engram"\nargs = ["mcp", "--tools=agent"]\n'
    )
  })

  it('writes OpenMetadata with the token named by an env var and never inlined', () => {
    const paths = testAgentPaths(home)
    const url = 'https://om.example.com/mcp'
    for (const agent of ['claude', 'antigravity', 'gentle-shell', 'codex'] as const) {
      applyAgentMcpEdits(agent, paths, [
        {
          action: 'set',
          name: 'openmetadata',
          owned: false,
          ...openMetadataEntrySpec(agent, url, 'OPENMETADATA_TOKEN')
        }
      ])
    }
    expect(JSON.parse(readFileSync(paths.mcpConfig('claude'), 'utf8'))).toEqual({
      mcpServers: {
        openmetadata: {
          type: 'http',
          url,
          headers: { Authorization: 'Bearer ${OPENMETADATA_TOKEN}' }
        }
      }
    })
    expect(JSON.parse(readFileSync(paths.mcpConfig('antigravity'), 'utf8'))).toEqual({
      mcpServers: {
        openmetadata: {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote@0.1.29',
            url,
            '--header',
            'Authorization:Bearer ${OPENMETADATA_TOKEN}'
          ],
          env: { OPENMETADATA_TOKEN: '$OPENMETADATA_TOKEN' }
        }
      }
    })
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toBe(
      `[mcp_servers.openmetadata]\nurl = "${url}"\nbearer_token_env_var = "OPENMETADATA_TOKEN"\n`
    )
  })

  it('rewrites an entry it owns and leaves a same-named entry it does not own', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('claude')
    const at = (url: string, owned: boolean): McpEntryEdit => ({
      action: 'set',
      name: 'openmetadata',
      owned,
      ...openMetadataEntrySpec('claude', url, 'OPENMETADATA_TOKEN')
    })
    writeFixture(path, '{"mcpServers":{"openmetadata":{"command":"mine"}}}')
    expect(applyAgentMcpEdits('claude', paths, [at('https://a.example', false)])).toMatchObject({
      outcomes: { openmetadata: 'left-existing' }
    })
    expect(readFileSync(path, 'utf8')).toBe('{"mcpServers":{"openmetadata":{"command":"mine"}}}')
    rmSync(path)
    applyAgentMcpEdits('claude', paths, [at('https://a.example', false)])
    expect(applyAgentMcpEdits('claude', paths, [at('https://b.example', true)])).toMatchObject({
      outcomes: { openmetadata: 'updated' }
    })
    expect(readFileSync(path, 'utf8')).toContain('https://b.example')
    expect(readFileSync(path, 'utf8')).not.toContain('https://a.example')
  })

  it('moves an owned Codex table only when its content changed', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('codex')
    const at = (url: string): McpEntryEdit => ({
      action: 'set',
      name: 'openmetadata',
      owned: true,
      ...openMetadataEntrySpec('codex', url, 'OPENMETADATA_TOKEN')
    })
    writeFixture(
      path,
      '[mcp_servers.openmetadata]\nurl = "https://a.example"\nbearer_token_env_var = "OPENMETADATA_TOKEN"\n\n[profiles.x]\nmodel = "y"\n'
    )
    expect(applyAgentMcpEdits('codex', paths, [at('https://a.example')])).toMatchObject({
      outcomes: { openmetadata: 'unchanged' }
    })
    expect(applyAgentMcpEdits('codex', paths, [at('https://b.example')])).toMatchObject({
      outcomes: { openmetadata: 'updated' }
    })
    expect(readFileSync(path, 'utf8')).toContain('url = "https://b.example"')
    expect(readFileSync(path, 'utf8')).toContain('[profiles.x]\nmodel = "y"\n')
  })
})

describe('applyAgentMcpEdits safety', () => {
  it('never adds or removes an entry Gentle Shell already ships', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('gentle-shell')
    const original =
      '{\n  "mcpServers": {\n    "engram": { "command": "engram", "args": ["mcp"] }\n  }\n}\n'
    writeFixture(path, original)
    expect(applyAgentMcpEdits('gentle-shell', paths, [engram('gentle-shell')])).toMatchObject({
      ok: true,
      outcomes: { engram: 'built-in' }
    })
    expect(readFileSync(path, 'utf8')).toBe(original)
    expect(existsSync(`${path}.massorca-backup`)).toBe(false)
  })

  it.each([
    ['claude', '{"mcpServers":"x"}'],
    ['claude', '[]'],
    ['antigravity', '{"mcpServers":[]}'],
    ['gentle-shell', '// not json\n{}'],
    ['codex', 'mcp_servers = { other = { command = "x" } }\n']
  ] as const)('refuses an unknown %s shape without writing or backing up', (agent, text) => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig(agent)
    writeFixture(path, text)
    expect(applyAgentMcpEdits(agent, paths, [engram(agent)])).toEqual({
      ok: false,
      reason: 'unsupported-shape'
    })
    expect(readFileSync(path, 'utf8')).toBe(text)
    expect(existsSync(`${path}.massorca-backup`)).toBe(false)
    expect(existsSync(`${path}.bak`)).toBe(false)
  })

  it('does not create the home of an agent that is not installed', () => {
    const bare = makeTempHome()
    try {
      const paths = testAgentPaths(bare)
      expect(applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])).toEqual({
        ok: true,
        outcomes: {},
        skipped: 'not-installed'
      })
      expect(existsSync(dirname(paths.mcpConfig('antigravity')))).toBe(false)
      expect(applyAgentInstructionsBlock('claude', paths, 'engram', true)).toEqual({
        ok: true,
        outcome: 'not-supported'
      })
      expect(existsSync(`${bare}/.claude`)).toBe(false)
    } finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })

  it('reports an unreadable config without writing', () => {
    const paths = testAgentPaths(home)
    mkdirSync(paths.mcpConfig('claude'), { recursive: true })
    expect(applyAgentMcpEdits('claude', paths, [engram('claude')])).toEqual({
      ok: false,
      reason: 'unreadable-config'
    })
  })
})

describe('readAgentEntryNames', () => {
  it('reads names only from each agent format', () => {
    const paths = testAgentPaths(home)
    writeFixture(paths.mcpConfig('gentle-shell'), '{"servers":{"engram":{"env":{"T":"secret"}}}}')
    writeFixture(paths.mcpConfig('codex'), '[mcp_servers.engram]\ncommand = "engram"\n')
    expect(readAgentEntryNames('gentle-shell', paths.mcpConfig('gentle-shell'))).toEqual({
      kind: 'present',
      names: new Set(['engram'])
    })
    expect(readAgentEntryNames('codex', paths.mcpConfig('codex'))).toEqual({
      kind: 'present',
      names: new Set(['engram'])
    })
    expect(readAgentEntryNames('antigravity', paths.mcpConfig('antigravity'))).toEqual({
      kind: 'absent'
    })
  })
})

describe('applyAgentInstructionsBlock', () => {
  it('adds the block once, round-trips, and skips a foreign Engram section', () => {
    const paths = testAgentPaths(home)
    const path = paths.instructions('claude') ?? ''
    writeFixture(path, '# Mine\n')
    expect(applyAgentInstructionsBlock('claude', paths, 'engram', true)).toEqual({
      ok: true,
      outcome: 'added'
    })
    expect(applyAgentInstructionsBlock('claude', paths, 'engram', true)).toEqual({
      ok: true,
      outcome: 'unchanged'
    })
    expect(applyAgentInstructionsBlock('claude', paths, 'engram', false)).toEqual({
      ok: true,
      outcome: 'removed'
    })
    expect(readFileSync(path, 'utf8')).toBe('# Mine\n')
    expect(readFileSync(`${path}.massorca-backup`, 'utf8')).toContain('massorca:engram:start')

    const codexPath = paths.instructions('codex') ?? ''
    writeFixture(codexPath, '## Engram Persistent Memory\n\nrules\n')
    expect(applyAgentInstructionsBlock('codex', paths, 'engram', true)).toEqual({
      ok: true,
      outcome: 'foreign-present'
    })
    expect(readFileSync(codexPath, 'utf8')).toBe('## Engram Persistent Memory\n\nrules\n')
  })

  it('has nothing to write for agents without an instructions file', () => {
    expect(
      applyAgentInstructionsBlock('antigravity', testAgentPaths(home), 'engram', true)
    ).toEqual({
      ok: true,
      outcome: 'not-supported'
    })
  })
})
