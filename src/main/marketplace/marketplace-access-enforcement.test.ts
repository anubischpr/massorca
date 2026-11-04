import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppAgent,
  type MarketplaceAppStatus
} from '../../shared/marketplace-apps'
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

function service(): ReturnType<typeof createMarketplaceAppsService> {
  return createMarketplaceAppsService({
    vault,
    paths: testAgentPaths(home),
    engramProgram: async () => ({ found: true, version: '1.2.3' }),
    githubAuthenticated: async () => true
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
      .filter((path) => !path.includes(join(home, '.orca')))
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

function allowedOf(status: MarketplaceAppStatus, agent: MarketplaceAppAgent): boolean | undefined {
  return status.agents.find((candidate) => candidate.agent === agent)?.allowed
}

/** Every agent except the named ones may use the app. */
function except(...ids: MarketplaceAppAgent[]): MarketplaceAppAccessPolicy {
  return { ...everyoneAccessPolicy(), agents: { mode: 'except', ids } }
}

/** Only the named agents may use the app. */
function only(...ids: MarketplaceAppAgent[]): MarketplaceAppAccessPolicy {
  return { ...everyoneAccessPolicy(), agents: { mode: 'only', ids } }
}

beforeEach(() => {
  home = makeTempHome()
  installAllAgents(home)
  vault = new MarketplaceVault(join(home, '.orca', 'marketplace'))
  installFakeSecretStore(true)
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('access policy enforcement on agent configs', () => {
  it('removes an excluded agent entries and block byte for byte, and restores them on re-allow', async () => {
    const paths = testAgentPaths(home)
    const claudeConfig = paths.mcpConfig('claude')
    const claudeText = '{\n  "mcpServers": {\n    "mine": { "command": "mine" }\n  }\n}\n'
    writeFixture(claudeConfig, claudeText)
    writeFixture(paths.instructions('claude') ?? '', '# Claude rules\n')
    await service().connect({ id: 'engram' })
    const connected = snapshot(home)

    const kept = await service().setAccessPolicy({ id: 'engram', policy: except('claude') })
    expect(kept).toMatchObject({ ok: true, status: { id: 'engram', access: except('claude') } })
    const excluded = await statusOf('engram')
    expect(entryOf(excluded, 'claude')).toBe('missing')
    expect(allowedOf(excluded, 'claude')).toBe(false)
    expect(entryOf(excluded, 'codex')).toBe('set')
    expect(readFileSync(claudeConfig, 'utf8')).toBe(claudeText)
    expect(readFileSync(paths.instructions('claude') ?? '', 'utf8')).toBe('# Claude rules\n')
    expect(readFileSync(paths.instructions('codex') ?? '', 'utf8')).toContain(
      'massorca:engram:start'
    )

    expect(
      await service().setAccessPolicy({ id: 'engram', policy: everyoneAccessPolicy() })
    ).toMatchObject({
      ok: true
    })
    expect(entryOf(await statusOf('engram'), 'claude')).toBe('set')
    expect(snapshot(home)).toEqual(connected)
  })

  it('never touches a Gentle Shell entry it did not write, however the policy changes', async () => {
    const path = testAgentPaths(home).mcpConfig('gentle-shell')
    const original =
      '{\n  "mcpServers": {\n    "engram": { "command": "engram", "args": ["mcp"] }\n  }\n}\n'
    writeFixture(path, original)
    await service().connect({ id: 'engram' })

    await service().setAccessPolicy({ id: 'engram', policy: except('gentle-shell') })
    const excluded = await statusOf('engram')
    expect(entryOf(excluded, 'gentle-shell')).toBe('built-in')
    expect(readFileSync(path, 'utf8')).toBe(original)

    await service().setAccessPolicy({ id: 'engram', policy: only() })
    expect(readFileSync(path, 'utf8')).toBe(original)
    expect(existsSync(`${path}.massorca-backup`)).toBe(false)
  })

  it('connects every agent except the ones an earlier policy keeps out', async () => {
    expect(
      await service().setAccessPolicy({ id: 'engram', policy: except('codex') })
    ).toMatchObject({ ok: true })
    expect(existsSync(testAgentPaths(home).mcpConfig('codex'))).toBe(false)

    await service().connect({ id: 'engram' })
    const status = await statusOf('engram')
    expect(entryOf(status, 'claude')).toBe('set')
    expect(entryOf(status, 'codex')).toBe('missing')
    expect(existsSync(testAgentPaths(home).mcpConfig('codex'))).toBe(false)
    expect(existsSync(testAgentPaths(home).instructions('codex') ?? '')).toBe(false)
  })

  it('stores a policy for an app that is not connected without writing any agent file', async () => {
    writeFixture(testAgentPaths(home).mcpConfig('claude'), '{"mcpServers":{}}\n')
    const before = snapshot(home)

    const result = await service().setAccessPolicy({ id: 'openmetadata', policy: only('codex') })
    expect(result).toMatchObject({
      ok: true,
      status: { id: 'openmetadata', connected: false, access: only('codex') }
    })
    expect(snapshot(home)).toEqual(before)
  })

  it('keeps an agent kept out of OpenMetadata out of a profile added later', async () => {
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    await service().setAccessPolicy({ id: 'openmetadata', policy: except('claude') })
    expect(entryOf(await statusOf('openmetadata'), 'claude')).toBe('missing')

    const added = await service().addOpenMetadataProfile({
      name: 'prod',
      url: 'https://prod.example.com/mcp',
      token: TOKEN
    })
    expect(added).toMatchObject({ ok: true })
    expect(readFileSync(testAgentPaths(home).mcpConfig('claude'), 'utf8')).not.toContain('prod')
    expect(readFileSync(testAgentPaths(home).mcpConfig('codex'), 'utf8')).toContain('prod')
  })

  it('keeps the policy through a disconnect, which removes only what MassOrca wrote', async () => {
    await service().connect({ id: 'engram' })
    await service().setAccessPolicy({ id: 'engram', policy: except('claude') })

    expect((await service().disconnect({ id: 'engram' })).ok).toBe(true)
    expect((await statusOf('engram')).access).toEqual(except('claude'))
    expect(existsSync(join(home, '.orca', 'marketplace', 'state.json'))).toBe(true)
  })

  it('rejects a policy that names an unknown agent and writes nothing', async () => {
    const before = snapshot(home)
    const invalid = {
      id: 'engram',
      policy: { ...everyoneAccessPolicy(), agents: { mode: 'only', ids: ['gemini'] } }
    }
    expect(await service().setAccessPolicy(invalid)).toEqual({ ok: false, reason: 'invalid-input' })
    expect(snapshot(home)).toEqual(before)
  })
})

describe('access policy and agent environment', () => {
  it('gives an agent kept out of one app none of that app env vars', async () => {
    await service().connect({ id: 'openmetadata', url: URL_, token: TOKEN })
    await service().setEngramServer({ url: 'https://engram.example.com', token: TOKEN })
    await service().setAccessPolicy({ id: 'engram', policy: except('codex') })

    expect(vault.buildAgentEnv('codex')).toEqual({ OPENMETADATA_TOKEN: TOKEN })
    expect(vault.buildAgentEnv('claude')).toEqual({
      OPENMETADATA_TOKEN: TOKEN,
      ENGRAM_CLOUD_TOKEN: TOKEN,
      ENGRAM_CLOUD_SERVER: 'https://engram.example.com'
    })
  })
})
