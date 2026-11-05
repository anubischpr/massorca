import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MarketplaceAppAgent, MarketplaceAppStatus } from '../../shared/marketplace-apps'
import {
  installAllAgents,
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore,
  testAgentPaths,
  writeFixture
} from './marketplace-apps-test-fixtures'
import { createMarketplaceAppsService } from './marketplace-apps-service'
import { MarketplaceVault } from './marketplace-vault'

const TOKEN = 'tok-SECRET-123'
const URL_ = 'https://om.example.com/mcp'

let home: string
let vault: MarketplaceVault
let githubAuthenticated: boolean

function service(): ReturnType<typeof createMarketplaceAppsService> {
  return createMarketplaceAppsService({
    vault,
    paths: testAgentPaths(home),
    engramProgram: async () => ({ found: true, version: '1.2.3' }),
    githubAuthenticated: async () => githubAuthenticated
  })
}

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? allFiles(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(
    allFiles(dir)
      .filter((path) => !path.includes('.massorca-backup') && !path.endsWith('.bak'))
      .filter((path) => !path.includes(`${join(home, '.orca')}`))
      .map((path) => [path, readFileSync(path, 'utf8')])
  )
}

async function statusOf(id: MarketplaceAppStatus['id']): Promise<MarketplaceAppStatus> {
  const status = (await service().listApps()).find((app) => app.id === id)
  if (!status) {
    throw new Error(`no status for ${id}`)
  }
  return status
}

function entryOf(status: MarketplaceAppStatus, agent: MarketplaceAppAgent): string | undefined {
  return status.agents.find((candidate) => candidate.agent === agent)?.entry
}

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'))
  installFakeSecretStore(true)
  githubAuthenticated = true
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('Engram', () => {
  it('connects every agent and disconnect restores every file byte for byte', async () => {
    const paths = testAgentPaths(home)
    writeFixture(paths.mcpConfig('claude'), '{\r\n  "mcpServers": {}\r\n}\r\n')
    writeFixture(paths.mcpConfig('codex'), '# mine\nmodel = "gpt"\n')
    writeFixture(paths.instructions('claude') ?? '', '# Claude rules')
    writeFixture(paths.instructions('codex') ?? '', '# Codex rules\n')
    const before = snapshot(home)

    const connected = await service().connect({ id: 'engram' })
    expect(connected.ok).toBe(true)
    expect(snapshot(home)).not.toEqual(before)
    const status = await statusOf('engram')
    expect(status.connected).toBe(true)
    expect(status.program).toEqual({ found: true, version: '1.2.3' })
    for (const agent of ['claude', 'codex', 'antigravity'] as const) {
      expect(entryOf(status, agent)).toBe('set')
    }
    expect(readFileSync(paths.instructions('claude') ?? '', 'utf8')).toContain(
      'mem_get_observation'
    )
    expect(readFileSync(paths.instructions('codex') ?? '', 'utf8')).toContain(
      'massorca:engram:start'
    )
    expect(existsSync(paths.instructions('antigravity') ?? join(home, 'none'))).toBe(false)

    expect((await service().disconnect({ id: 'engram' })).ok).toBe(true)
    const after = snapshot(home)
    // Antigravity and Gentle Shell had no file, so MassOrca's now-empty files are the only extras.
    for (const [path, text] of Object.entries(before)) {
      expect(after[path]).toBe(text)
    }
    expect(existsSync(join(home, '.orca', 'marketplace', 'state.json'))).toBe(false)
  })

  it('treats a Gentle Shell engram it did not write as built in, and never removes it', async () => {
    const path = testAgentPaths(home).mcpConfig('gentle-shell')
    const original =
      '{\n  "mcpServers": {\n    "engram": { "command": "engram", "args": ["mcp"] }\n  }\n}\n'
    writeFixture(path, original)
    await service().connect({ id: 'engram' })
    const status = await statusOf('engram')
    expect(entryOf(status, 'gentle-shell')).toBe('built-in')
    expect(readFileSync(path, 'utf8')).toBe(original)
    expect(existsSync(`${path}.massorca-backup`)).toBe(false)
    await service().disconnect({ id: 'engram' })
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('does not add a second Engram section when the agent already has one', async () => {
    const claudeMd = testAgentPaths(home).instructions('claude') ?? ''
    writeFixture(claudeMd, '## Engram Persistent Memory\n\nmy rules\n')
    await service().connect({ id: 'engram' })
    expect(readFileSync(claudeMd, 'utf8')).toBe('## Engram Persistent Memory\n\nmy rules\n')
    await service().disconnect({ id: 'engram' })
    expect(readFileSync(claudeMd, 'utf8')).toBe('## Engram Persistent Memory\n\nmy rules\n')
  })

  it('keeps a pre-existing Claude entry of its own through connect and disconnect', async () => {
    const path = testAgentPaths(home).mcpConfig('claude')
    const original = '{"mcpServers":{"engram":{"command":"my-engram"}}}'
    writeFixture(path, original)
    await service().connect({ id: 'engram' })
    expect(readFileSync(path, 'utf8')).toBe(original)
    await service().disconnect({ id: 'engram' })
    expect(readFileSync(path, 'utf8')).toBe(original)
  })

  it('stores the cloud server and token in the vault and exposes them as env vars', async () => {
    const result = await service().setEngramServer({
      url: 'https://engram.example.com',
      token: TOKEN
    })
    expect(result).toMatchObject({
      ok: true,
      status: {
        id: 'engram',
        serverUrl: 'https://engram.example.com',
        credential: { stored: true }
      }
    })
    expect(vault.buildAgentEnv()).toEqual({
      ENGRAM_CLOUD_TOKEN: TOKEN,
      ENGRAM_CLOUD_SERVER: 'https://engram.example.com'
    })
    await service().setEngramServer({ url: null })
    expect(vault.buildAgentEnv()).toEqual({})
  })

  it('reports Gentle Shell as fully integrated with Engram, like Claude Code and Codex', async () => {
    const engram = (await service().listApps()).find((app) => app.id === 'engram')
    expect(engram?.agents.map((agent) => [agent.agent, agent.level])).toEqual([
      ['claude', 'full'],
      ['codex', 'full'],
      ['antigravity', 'tools-only'],
      ['gentle-shell', 'full']
    ])
  })

  it('drops the stored token when the server changes without a new one', async () => {
    await service().setEngramServer({ url: 'https://engram.example.com', token: TOKEN })
    await service().setEngramServer({ url: 'https://engram.example.com' })
    expect(vault.buildAgentEnv()).toEqual({
      ENGRAM_CLOUD_TOKEN: TOKEN,
      ENGRAM_CLOUD_SERVER: 'https://engram.example.com'
    })
    const result = await service().setEngramServer({ url: 'https://elsewhere.example.com' })
    expect(result).toMatchObject({ ok: true, status: { credential: { stored: false } } })
    expect(vault.buildAgentEnv()).not.toHaveProperty('ENGRAM_CLOUD_TOKEN')
  })

  it('reports the agent that failed and still finishes the others', async () => {
    const paths = testAgentPaths(home)
    writeFixture(paths.mcpConfig('claude'), '{"mcpServers":[]}')
    const result = await service().connect({ id: 'engram' })
    expect(result).toEqual({ ok: false, reason: 'unsupported-shape', agent: 'claude' })
    expect(readFileSync(paths.mcpConfig('claude'), 'utf8')).toBe('{"mcpServers":[]}')
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toContain('[mcp_servers.engram]')
    const status = await statusOf('engram')
    expect(entryOf(status, 'codex')).toBe('set')
    expect(entryOf(status, 'claude')).toBe('unreadable')
  })
})

describe('OpenMetadata', () => {
  it('refuses to store anything when the vault cannot get a master key', async () => {
    // Why: a file where the key folder should be makes the key impossible to create.
    writeFileSync(join(home, 'blocked'), 'x')
    vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
      keyDir: join(home, 'blocked', 'keys')
    })
    const before = snapshot(home)
    expect(await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })).toEqual({
      ok: false,
      reason: 'vault-unavailable'
    })
    expect(snapshot(home)).toEqual(before)
    expect(existsSync(join(home, '.orca'))).toBe(false)
  })

  it('writes the connection to every agent with no token in any config file', async () => {
    const paths = testAgentPaths(home)
    expect((await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })).ok).toBe(true)
    for (const [path, text] of Object.entries(snapshot(home))) {
      expect(text, path).not.toContain(TOKEN)
    }
    for (const entry of allFiles(join(home, '.orca'))) {
      expect(readFileSync(entry, 'utf8')).not.toContain(TOKEN)
    }
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toContain(`url = "${URL_}"`)
    expect(readFileSync(paths.instructions('claude') ?? '', 'utf8')).toContain(
      'massorca:openmetadata:start'
    )
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: TOKEN })
    const status = await statusOf('openmetadata')
    expect(status).toMatchObject({ connected: true, serverUrl: URL_, credential: { stored: true } })
    expect(JSON.stringify(status)).not.toContain(TOKEN)
  })

  it('adds and removes a profile with its own entry, env var and token file', async () => {
    const paths = testAgentPaths(home)
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    const added = await service().addOpenMetadataProfile({
      name: 'ana',
      url: 'https://ana.example.com/mcp',
      token: 'ana-secret'
    })
    expect(added).toMatchObject({
      ok: true,
      status: { profiles: [{ name: 'ana', url: 'https://ana.example.com/mcp', hasToken: true }] }
    })
    expect(JSON.parse(readFileSync(paths.mcpConfig('claude'), 'utf8')).mcpServers.ana).toEqual({
      type: 'http',
      url: 'https://ana.example.com/mcp',
      headers: { Authorization: 'Bearer ${OPENMETADATA_TOKEN_ANA}' }
    })
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toContain(
      'bearer_token_env_var = "OPENMETADATA_TOKEN_ANA"'
    )
    expect(vault.buildAgentEnv()).toEqual({
      OPENMETADATA_TOKEN: TOKEN,
      OPENMETADATA_TOKEN_ANA: 'ana-secret'
    })
    expect((await service().removeOpenMetadataProfile({ name: 'ana' })).ok).toBe(true)
    expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).not.toContain('ana')
    expect(
      JSON.parse(readFileSync(paths.mcpConfig('claude'), 'utf8')).mcpServers.ana
    ).toBeUndefined()
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: TOKEN })
  })

  it('rejects a profile that would shadow an entry or share an env var', async () => {
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    for (const name of ['openmetadata', 'Engram', 'bad name', '']) {
      expect(await service().addOpenMetadataProfile({ name, url: URL_, token: 'x' })).toEqual({
        ok: false,
        reason: 'invalid-input'
      })
    }
    await service().addOpenMetadataProfile({ name: 'a-b', url: URL_, token: 'x' })
    expect(await service().addOpenMetadataProfile({ name: 'a_b', url: URL_, token: 'y' })).toEqual({
      ok: false,
      reason: 'invalid-input'
    })
  })

  it('replaces the token without touching any agent file', async () => {
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    const before = snapshot(home)
    expect((await service().setOpenMetadataToken({ token: 'new-token' })).ok).toBe(true)
    expect(snapshot(home)).toEqual(before)
    expect(vault.buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'new-token' })
  })

  it('disconnect removes only what MassOrca wrote and deletes every credential', async () => {
    const paths = testAgentPaths(home)
    const claudeOriginal =
      '{\n  "mcpServers": {\n    "openmetadata-escritura": { "command": "mine" }\n  }\n}\n'
    writeFixture(paths.mcpConfig('claude'), claudeOriginal)
    writeFixture(
      paths.mcpConfig('gentle-shell'),
      '{"mcpServers":{"openmetadata":{"command":"shipped"}}}'
    )
    writeFixture(paths.instructions('codex') ?? '', 'mine\n')
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    await service().addOpenMetadataProfile({ name: 'ana', url: URL_, token: 'ana-secret' })
    const result = await service().disconnect({ id: 'openmetadata' })
    expect(result.ok).toBe(true)
    expect(readFileSync(paths.mcpConfig('claude'), 'utf8')).toBe(claudeOriginal)
    expect(readFileSync(paths.mcpConfig('gentle-shell'), 'utf8')).toBe(
      '{"mcpServers":{"openmetadata":{"command":"shipped"}}}'
    )
    expect(readFileSync(paths.instructions('codex') ?? '', 'utf8')).toBe('mine\n')
    expect(vault.buildAgentEnv()).toEqual({})
    expect(existsSync(join(home, '.orca', 'marketplace', 'state.json'))).toBe(false)
    expect(readdirSync(join(home, '.orca', 'marketplace'))).toEqual([])
  })

  it('rejects invalid input for every method', async () => {
    const api = service()
    const bad = { ok: false, reason: 'invalid-input' }
    expect(await api.connect({ id: 'openmetadata', url: 'ftp://x', token: TOKEN })).toEqual(bad)
    expect(await api.connect({ id: 'openmetadata', url: URL_, token: 'has space' })).toEqual(bad)
    expect(
      await api.connect({ id: 'openmetadata', url: 'https://u:p@x.example', token: TOKEN })
    ).toEqual(bad)
    expect(await api.connect({ id: 'other' })).toEqual(bad)
    expect(
      await api.connect({ id: 'openmetadata', url: `${URL_}?token=abc`, token: TOKEN })
    ).toEqual(bad)
    expect(await api.connect({ id: 'openmetadata', url: `${URL_}#t`, token: TOKEN })).toEqual(bad)
    expect(await api.setOpenMetadataToken({ token: TOKEN })).toEqual(bad)
    expect(await api.removeOpenMetadataProfile({ name: 'ghost' })).toEqual(bad)
    expect(await api.setEngramServer({ url: 'not a url' })).toEqual(bad)
    expect(await api.setEngramServer(null)).toEqual(bad)
    expect(existsSync(join(home, '.orca'))).toBe(false)
  })
})

describe('GitHub', () => {
  it('reports the signed-in state and its levels without any config write', async () => {
    const before = snapshot(home)
    const github = (await service().listApps()).find((app) => app.id === 'github')
    expect(github?.connected).toBe(true)
    expect(github?.agents.map((agent) => [agent.agent, agent.level])).toEqual([
      ['claude', 'full'],
      ['codex', 'full'],
      ['antigravity', 'tools-only'],
      ['gentle-shell', 'tools-only']
    ])
    githubAuthenticated = false
    expect((await service().listApps()).find((app) => app.id === 'github')?.connected).toBe(false)
    expect(snapshot(home)).toEqual(before)
  })

  it('hides GitHub on disconnect and shows it again on connect, without touching agent files', async () => {
    const api = service()
    const agentFiles = (): Record<string, string> =>
      Object.fromEntries(Object.entries(snapshot(home)).filter(([path]) => !path.includes('.orca')))
    const before = agentFiles()
    const hidden = await api.disconnect({ id: 'github' })
    expect(hidden.ok && hidden.status.connected).toBe(false)
    expect((await service().listApps()).find((app) => app.id === 'github')?.connected).toBe(false)
    const shown = await api.connect({ id: 'github' })
    expect(shown.ok && shown.status.connected).toBe(true)
    expect(agentFiles()).toEqual(before)
  })
})

describe('state file', () => {
  it('survives a damaged file without writing over other settings', async () => {
    mkdirSync(join(home, '.orca', 'marketplace'), { recursive: true })
    writeFileSync(join(home, '.orca', 'marketplace', 'state.json'), '{broken')
    expect((await service().listApps()).map((app) => app.id)).toEqual([
      'engram',
      'openmetadata',
      'github'
    ])
  })
})

describe('a config that links outside this home', () => {
  it('reports outside-home for that agent, leaves the real file alone and finishes the others', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'marketplace-service-outside-'))
    try {
      const paths = testAgentPaths(home)
      rmSync(join(home, '.gemini'), { recursive: true, force: true })
      mkdirSync(join(outside, 'config'), { recursive: true })
      writeFileSync(join(outside, 'config', 'mcp_config.json'), '{"real":"user"}')
      symlinkSync(outside, join(home, '.gemini'), 'junction')

      const result = await service().connect({ id: 'engram' })

      expect(result).toEqual({ ok: false, reason: 'outside-home', agent: 'antigravity' })
      expect(readFileSync(join(outside, 'config', 'mcp_config.json'), 'utf8')).toBe(
        '{"real":"user"}'
      )
      expect(readFileSync(paths.mcpConfig('codex'), 'utf8')).toContain('[mcp_servers.engram]')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('marks the agent whose settings folder leads out of the home in the status, and only that one', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'marketplace-service-outside-'))
    try {
      rmSync(join(home, '.gemini'), { recursive: true, force: true })
      mkdirSync(join(outside, 'config'), { recursive: true })
      writeFileSync(join(outside, 'config', 'mcp_config.json'), '{"real":"user"}')
      symlinkSync(outside, join(home, '.gemini'), 'junction')

      const engram = await statusOf('engram')

      expect(
        engram.agents.filter((row) => row.outsideHome === true).map((row) => row.agent)
      ).toEqual(['antigravity'])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('marks a Claude settings file that a folder link takes out of the home', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'marketplace-service-outside-'))
    try {
      const paths = testAgentPaths(home)
      writeFileSync(join(outside, 'claude.json'), '{"mcpServers":{}}')
      symlinkSync(outside, join(home, 'linked-claude'), 'junction')
      const linked = createMarketplaceAppsService({
        vault,
        paths: {
          ...paths,
          mcpConfig: (agent) =>
            agent === 'claude' ? join(home, 'linked-claude', 'claude.json') : paths.mcpConfig(agent)
        },
        engramProgram: async () => ({ found: true, version: '1.2.3' }),
        githubAuthenticated: async () => githubAuthenticated
      })

      const openmetadata = (await linked.listApps()).find((app) => app.id === 'openmetadata')

      expect(openmetadata?.agents.find((row) => row.agent === 'claude')?.outsideHome).toBe(true)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
