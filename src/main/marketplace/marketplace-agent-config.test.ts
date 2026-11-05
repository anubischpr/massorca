import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyAgentMcpEdits,
  readAgentEntryNames,
  type McpEntryEdit
} from './marketplace-agent-config'
import { applyAgentInstructionsBlock } from './marketplace-agent-instructions'
import { engramEntrySpec, openMetadataEntrySpec } from './marketplace-entry-specs'
import {
  canCreateFileLinks,
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

describe('applyAgentMcpEdits with the reported Antigravity file shape', () => {
  const BOM = String.fromCharCode(0xfeff)
  const BACKSLASH = String.fromCharCode(92)
  // Seven servers, Windows paths with escaped backslashes, nested arrays and objects, and an engram entry the user wrote.
  const ANTIGRAVITY_SHAPE = `{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:@BS@@BS@Users@BS@@BS@palom@BS@@BS@projects"],
      "autoApprove": ["read_file", "list_directory"],
      "disabled": false
    },
    "github": {
      "command": "C:@BS@@BS@Program Files@BS@@BS@GitHub CLI@BS@@BS@gh.exe",
      "args": ["mcp"],
      "env": { "GH_HOST": "github.com", "TIMEOUT": 30000 },
      "timeout": 30000
    },
    "engram": {
      "command": "C:@BS@@BS@Users@BS@@BS@palom@BS@@BS@go@BS@@BS@bin@BS@@BS@engram.exe",
      "args": ["mcp"],
      "env": {}
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--browser=chrome"],
      "timeout": 60000
    },
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "includeTools": ["fetch"]
    }
  }
}
`.replaceAll('@BS@', BACKSLASH)

  it('leaves a user-written engram entry alone in a file without a byte order mark', () => {
    const paths = testAgentPaths(home)
    writeFixture(paths.mcpConfig('antigravity'), ANTIGRAVITY_SHAPE)
    expect(applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])).toMatchObject({
      ok: true,
      outcomes: { engram: 'left-existing' }
    })
    expect(readFileSync(paths.mcpConfig('antigravity'), 'utf8')).toBe(ANTIGRAVITY_SHAPE)
  })

  it('leaves the same entry alone when the file was saved with a byte order mark', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('antigravity')
    writeFixture(path, `${BOM}${ANTIGRAVITY_SHAPE}`)
    expect(applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])).toMatchObject({
      ok: true,
      outcomes: { engram: 'left-existing' }
    })
    expect(readFileSync(path, 'utf8')).toBe(`${BOM}${ANTIGRAVITY_SHAPE}`)
  })

  it('adds OpenMetadata beside the user-written engram entry and keeps the byte order mark', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('antigravity')
    writeFixture(path, `${BOM}${ANTIGRAVITY_SHAPE}`)
    expect(
      applyAgentMcpEdits('antigravity', paths, [
        {
          action: 'set',
          name: 'openmetadata',
          owned: false,
          ...openMetadataEntrySpec(
            'antigravity',
            'https://om.example.com/mcp',
            'OPENMETADATA_TOKEN'
          )
        }
      ])
    ).toMatchObject({ ok: true, outcomes: { openmetadata: 'added' } })
    const text = readFileSync(path, 'utf8')
    expect(text.startsWith(BOM)).toBe(true)
    const servers = JSON.parse(text.slice(BOM.length)).mcpServers
    expect(Object.keys(servers)).toHaveLength(8)
    expect(servers.engram).toEqual(JSON.parse(ANTIGRAVITY_SHAPE).mcpServers.engram)
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

describe('empty config files', () => {
  it.each([
    ['empty', ''],
    ['whitespace only', ' \r\n\t\n']
  ])(
    'adds the entry to a %s antigravity file instead of calling it unsupported',
    (_label, text) => {
      const paths = testAgentPaths(home)
      const path = paths.mcpConfig('antigravity')
      writeFixture(path, text)

      const result = applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])

      expect(result).toMatchObject({ ok: true, outcomes: { engram: 'added' } })
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
        mcpServers: { engram: expect.objectContaining({ command: 'engram' }) }
      })
    }
  )

  it('treats an empty file as having no entries to read', () => {
    const paths = testAgentPaths(home)
    writeFixture(paths.mcpConfig('gentle-shell'), '')
    expect(readAgentEntryNames('gentle-shell', paths.mcpConfig('gentle-shell'))).toEqual({
      kind: 'present',
      names: new Set()
    })
  })

  it('leaves an empty file alone when asked to remove an entry that is not there', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('antigravity')
    writeFixture(path, '')
    expect(applyAgentMcpEdits('antigravity', paths, [removeEngram])).toMatchObject({
      ok: true,
      outcomes: { engram: 'absent' }
    })
    expect(readFileSync(path, 'utf8')).toBe('')
  })
})

describe('a config that links outside the home', () => {
  let outside: string
  beforeEach(() => {
    outside = mkdtempSync(join(tmpdir(), 'marketplace-config-outside-'))
  })
  afterEach(() => {
    rmSync(outside, { recursive: true, force: true })
  })

  it.skipIf(!canCreateFileLinks())(
    'is refused for MCP edits and the real file keeps every byte (skipped without file symlink privilege)',
    () => {
      const paths = testAgentPaths(home)
      const target = join(outside, 'mcp.json')
      writeFileSync(target, '{\n  "mcpServers": {}\n}\n')
      const link = paths.mcpConfig('gentle-shell')
      mkdirSync(dirname(link), { recursive: true })
      symlinkSync(target, link, 'file')
      const before = readFileSync(target)

      expect(applyAgentMcpEdits('gentle-shell', paths, [engram('gentle-shell')])).toEqual({
        ok: false,
        reason: 'outside-home'
      })
      expect(readFileSync(target).equals(before)).toBe(true)
      expect(lstatSync(link).isSymbolicLink()).toBe(true)
    }
  )

  it('is refused when the agent folder itself links out', () => {
    const paths = testAgentPaths(home)
    rmSync(join(home, '.gemini'), { recursive: true, force: true })
    symlinkSync(outside, join(home, '.gemini'), 'junction')
    mkdirSync(join(outside, 'config'))
    writeFileSync(join(outside, 'config', 'mcp_config.json'), '{}')
    const before = readFileSync(join(outside, 'config', 'mcp_config.json'))

    expect(applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])).toEqual({
      ok: false,
      reason: 'outside-home'
    })
    expect(readFileSync(join(outside, 'config', 'mcp_config.json')).equals(before)).toBe(true)
  })

  it('is refused for the Codex TOML file', () => {
    const paths = testAgentPaths(home)
    rmSync(join(home, '.codex'), { recursive: true, force: true })
    symlinkSync(outside, join(home, '.codex'), 'junction')
    writeFileSync(join(outside, 'config.toml'), 'model = "x"\n')

    expect(applyAgentMcpEdits('codex', paths, [engram('codex')])).toEqual({
      ok: false,
      reason: 'outside-home'
    })
    expect(readFileSync(join(outside, 'config.toml'), 'utf8')).toBe('model = "x"\n')
    expect(existsSync(join(outside, 'config.toml.bak'))).toBe(false)
  })

  it('is refused for the instructions block', () => {
    const paths = testAgentPaths(home)
    rmSync(join(home, '.claude'), { recursive: true, force: true })
    symlinkSync(outside, join(home, '.claude'), 'junction')
    writeFileSync(join(outside, 'CLAUDE.md'), '# Real user\n')

    expect(applyAgentInstructionsBlock('claude', paths, 'engram', true)).toEqual({
      ok: false,
      reason: 'outside-home'
    })
    expect(readFileSync(join(outside, 'CLAUDE.md'), 'utf8')).toBe('# Real user\n')
  })

  it('still works through a link that stays inside the home', () => {
    const paths = testAgentPaths(home)
    const dotfiles = join(home, 'dotfiles', 'gemini')
    mkdirSync(join(dotfiles, 'config'), { recursive: true })
    writeFileSync(join(dotfiles, 'config', 'mcp_config.json'), '{}')
    rmSync(join(home, '.gemini'), { recursive: true, force: true })
    symlinkSync(dotfiles, join(home, '.gemini'), 'junction')

    expect(applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])).toMatchObject({
      ok: true,
      outcomes: { engram: 'added' }
    })
    expect(readFileSync(join(dotfiles, 'config', 'mcp_config.json'), 'utf8')).toContain('engram')
  })
})

describe('the first original survives later writes', () => {
  it('keeps the user file as it was before MassOrca first touched it', () => {
    const paths = testAgentPaths(home)
    const path = paths.mcpConfig('antigravity')
    const original = '{\n  "mcpServers": { "mine": { "command": "x" } }\n}\n'
    writeFixture(path, original)

    applyAgentMcpEdits('antigravity', paths, [engram('antigravity')])
    applyAgentMcpEdits('antigravity', paths, [removeEngram])

    expect(readFileSync(`${path}.massorca-original`, 'utf8')).toBe(original)
    expect(readFileSync(path, 'utf8')).toBe(original)
  })
})
