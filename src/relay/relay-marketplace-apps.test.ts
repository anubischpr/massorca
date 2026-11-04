import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKETPLACE_APPS_HOST_METHODS } from '../shared/rpc-contract/marketplace-apps-params'
import {
  installAllAgents,
  makeTempHome,
  writeFixture
} from '../main/marketplace/marketplace-apps-test-fixtures'
import { createHomeMarketplaceAgentPaths } from '../main/marketplace/marketplace-home-agent-paths'
import { createMarketplaceAppsService } from '../main/marketplace/marketplace-apps-service'
import { MarketplaceVault } from '../main/marketplace/marketplace-vault'
import type { RelayDispatcher } from './dispatcher'
import { MarketplaceAppsHandler } from './relay-marketplace-apps'

const TOKEN = 'tok-SECRET-123'
const OPENMETADATA_URL = 'https://om.example.com/mcp'

type Handler = (params: Record<string, unknown>) => Promise<unknown>

let home: string
let vault: MarketplaceVault
let handlers: Map<string, Handler>

function call(name: keyof typeof MARKETPLACE_APPS_HOST_METHODS, params = {}): Promise<unknown> {
  const handler = handlers.get(MARKETPLACE_APPS_HOST_METHODS[name])
  if (!handler) {
    throw new Error(`no handler for ${name}`)
  }
  return handler(params)
}

function agentFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!path.startsWith(join(home, '.orca'))) {
          walk(path)
        }
      } else if (!entry.name.includes('massorca-backup') && !entry.name.endsWith('.bak')) {
        files[path] = readFileSync(path, 'utf8')
      }
    }
  }
  walk(home)
  return files
}

function statusEntries(answer: unknown): Record<string, string> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the test reads the documented status answer shape.
  const status = (answer as { status: { agents: { agent: string; entry: string }[] } }).status
  return Object.fromEntries(status.agents.map((agent) => [agent.agent, agent.entry]))
}

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  // A plain Node host: no keychain, so the vault key is a 0600 file under the host's own data dir.
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'), {
    sealer: () => null,
    hostLabel: 'ssh-host'
  })
  const service = createMarketplaceAppsService({
    vault,
    paths: createHomeMarketplaceAgentPaths({ home: () => home, env: () => ({}) }),
    engramProgram: async () => ({ found: true, version: '1.2.3' }),
    githubAuthenticated: async () => false
  })
  handlers = new Map()
  const dispatcher = {
    onRequest: vi.fn((method: string, handler: Handler) => handlers.set(method, handler))
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only registers request methods.
  new MarketplaceAppsHandler(dispatcher as unknown as RelayDispatcher, service)
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('relay marketplace.apps.* methods', () => {
  it('registers every operation under its contract name', () => {
    expect([...handlers.keys()].sort()).toEqual(Object.values(MARKETPLACE_APPS_HOST_METHODS).sort())
  })

  it('lists the apps of the host with names and booleans only', async () => {
    const answer = await call('listApps')
    expect(answer).toMatchObject({
      ok: true,
      apps: [{ id: 'engram' }, { id: 'openmetadata' }, { id: 'github' }]
    })
    expect(JSON.stringify(answer)).not.toContain(TOKEN)
  })

  it('writes all four agents on this host and keeps the token in the host vault', async () => {
    const before = agentFiles()
    const answer = await call('connect', {
      id: 'openmetadata',
      url: OPENMETADATA_URL,
      token: TOKEN
    })
    expect(statusEntries(answer)).toEqual({
      claude: 'set',
      codex: 'set',
      antigravity: 'set',
      'gentle-shell': 'set'
    })
    expect(JSON.stringify(answer)).not.toContain(TOKEN)
    for (const text of Object.values(agentFiles())) {
      expect(text).not.toContain(TOKEN)
    }
    expect(vault.buildAgentEnv()).toMatchObject({ OPENMETADATA_TOKEN: TOKEN })
    expect(agentFiles()).not.toEqual(before)
    expect(existsSync(join(home, '.claude.json'))).toBe(true)
  })

  it('leaves a Gentle Shell entry it did not write alone, and a disconnect restores every file', async () => {
    const gentle = join(home, '.gentle-shell', 'agent', 'mcp.json')
    const builtIn =
      '{\n  "mcpServers": {\n    "engram": { "command": "engram", "args": ["mcp"] }\n  }\n}\n'
    writeFixture(gentle, builtIn)
    writeFixture(join(home, '.codex', 'config.toml'), '# mine\r\nmodel = "gpt"\r\n')
    const before = agentFiles()

    const connected = await call('connect', { id: 'engram' })
    expect(statusEntries(connected)['gentle-shell']).toBe('built-in')
    expect(statusEntries(connected).claude).toBe('set')
    expect(readFileSync(gentle, 'utf8')).toBe(builtIn)
    expect(existsSync(`${gentle}.massorca-backup`)).toBe(false)

    await call('disconnect', { id: 'engram' })
    const after = agentFiles()
    for (const [path, text] of Object.entries(before)) {
      expect(after[path]).toBe(text)
    }
    expect(readFileSync(gentle, 'utf8')).toBe(builtIn)
  })

  it('removes only the entries MassOrca wrote, leaving the user own servers', async () => {
    const claude = join(home, '.claude.json')
    const mine = '{\n  "mcpServers": {\n    "mine": { "command": "mine" }\n  }\n}\n'
    writeFixture(claude, mine)
    await call('connect', { id: 'engram' })
    expect(readFileSync(claude, 'utf8')).toContain('"mine"')
    expect(readFileSync(claude, 'utf8')).toContain('"engram"')
    await call('disconnect', { id: 'engram' })
    expect(readFileSync(claude, 'utf8')).toBe(mine)
  })

  it('refuses malformed arguments without touching any file', async () => {
    const before = agentFiles()
    for (const [name, params] of [
      ['connect', { id: 'openmetadata', url: 'ftp://x', token: TOKEN }],
      ['connect', { id: 'nope' }],
      ['disconnect', {}],
      ['setOpenMetadataToken', { token: 'two words' }],
      ['addOpenMetadataProfile', { name: 'openmetadata', url: OPENMETADATA_URL, token: TOKEN }],
      ['setAccessPolicy', { id: 'engram', policy: { agents: { mode: 'x', ids: [] } } }]
    ] as const) {
      const answer = await call(name, params)
      expect(answer).toEqual({ ok: false, reason: 'invalid-input' })
      expect(JSON.stringify(answer)).not.toContain(TOKEN)
    }
    expect(agentFiles()).toEqual(before)
  })

  it('takes Antigravity out of the files once the policy leaves it out', async () => {
    await call('connect', { id: 'engram' })
    const answer = await call('setAccessPolicy', {
      id: 'engram',
      policy: {
        agents: { mode: 'except', ids: ['antigravity'] },
        bots: { mode: 'everyone', botIds: [], teamIds: [] }
      }
    })
    expect(statusEntries(answer).antigravity).toBe('missing')
    expect(statusEntries(answer).claude).toBe('set')
  })
})

describe('home agent paths', () => {
  it('follows CLAUDE_CONFIG_DIR and Gentle Shell own folder setting on that host', () => {
    const paths = createHomeMarketplaceAgentPaths({
      home: () => home,
      env: () => ({ CLAUDE_CONFIG_DIR: join(home, 'cc'), PI_CODING_AGENT_DIR: join(home, 'gs') })
    })
    expect(paths.mcpConfig('claude')).toBe(join(home, 'cc', '.claude.json'))
    expect(paths.instructions('claude')).toBe(join(home, 'cc', 'CLAUDE.md'))
    expect(paths.mcpConfig('gentle-shell')).toBe(join(home, 'gs', 'mcp.json'))
    expect(paths.mcpConfig('codex')).toBe(join(home, '.codex', 'config.toml'))
  })
})
