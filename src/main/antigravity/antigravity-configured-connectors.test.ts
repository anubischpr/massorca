import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readAntigravityConfiguredConnectors } from './antigravity-configured-connectors'

const BOM = String.fromCharCode(0xfeff)
const homes: string[] = []
afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

/** Writes files under a fresh home; keys are paths relative to it. */
async function writeHome(files: Record<string, string>): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'agy-home-'))
  homes.push(home)
  for (const [path, text] of Object.entries(files)) {
    const file = join(home, ...path.split('/'))
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, text)
  }
  return home
}

const GLOBAL_CONFIG = JSON.stringify({
  mcpServers: {
    codegraph: {
      command: 'codegraph',
      args: ['serve'],
      env: { CODEGRAPH_TOKEN: 'synthetic-secret' }
    },
    engram: { command: 'engram', args: ['mcp'] },
    remote: {
      url: 'https://mcp.example.test/mcp',
      headers: { Authorization: 'Bearer synthetic-secret' }
    },
    paused: { command: 'paused-srv', disabled: true },
    broken: 'not-an-object'
  }
})

describe('readAntigravityConfiguredConnectors', () => {
  it('lists the global and enabled plugin servers as agy names them, never their commands or env', async () => {
    const home = await writeHome({
      '.gemini/config/mcp_config.json': GLOBAL_CONFIG,
      '.gemini/config/config.json': JSON.stringify({
        plugins: { 'openmetadata-policy': { enabled: true }, science: { enabled: false } }
      }),
      '.gemini/config/plugins/openmetadata-policy/plugin.json': '{"name":"openmetadata-policy"}',
      '.gemini/config/plugins/openmetadata-policy/mcp_config.json': JSON.stringify({
        mcpServers: {
          openmetadata: { command: 'om-mcp', args: ['--token', 'synthetic-secret'] },
          jev: { command: 'jev', env: { JEV_ROUTING_PROFILE: 'synthetic' } }
        }
      }),
      '.gemini/config/plugins/science/plugin.json': '{"name":"science"}',
      '.gemini/config/plugins/science/mcp_config.json': JSON.stringify({
        mcpServers: { viewer: { command: 'viewer' } }
      }),
      '.gemini/config/plugins/no-manifest/mcp_config.json': JSON.stringify({
        mcpServers: { orphan: { command: 'orphan' } }
      }),
      '.gemini/antigravity-cli/mcp_config.json': JSON.stringify({
        mcpServers: { context7: { serverUrl: 'https://legacy.example.test/mcp' } }
      }),
      '.gemini/settings.json': JSON.stringify({
        mcpServers: { 'gemini-only': { command: 'gemini-only' } }
      }),
      '.gemini/antigravity-cli/settings.json': JSON.stringify({
        mcpServers: { 'cli-settings': { command: 'cli-settings' } }
      }),
      '.gemini/antigravity-cli/plugins/gentle-ai-engram/plugin.json': '{"name":"gentle-ai-engram"}',
      '.gemini/antigravity-cli/plugins/gentle-ai-engram/mcp_config.json': JSON.stringify({
        mcpServers: { engram: { command: 'engram' } }
      })
    })
    const snapshot = await readAntigravityConfiguredConnectors(home)
    expect(snapshot?.servers).toEqual([
      { name: 'codegraph', status: 'unknown', configured: true },
      { name: 'engram', status: 'unknown', configured: true },
      { name: 'remote', status: 'unknown', configured: true },
      { name: 'paused', status: 'disabled', configured: true },
      { name: 'openmetadata-policy_openmetadata', status: 'unknown', configured: true },
      { name: 'openmetadata-policy_jev', status: 'unknown', configured: true },
      { name: 'science_viewer', status: 'disabled', configured: true }
    ])
    const published = JSON.stringify(snapshot)
    for (const leaked of [
      'synthetic-secret',
      'mcp.example.test',
      'om-mcp',
      'legacy.example.test'
    ]) {
      expect(published).not.toContain(leaked)
    }
  })

  it('reads only strict JSON, so a comment, trailing comma, BOM or array mcpServers hides that file', async () => {
    const cases = [
      '// note\n{"mcpServers":{"a":{"command":"a"}}}',
      '{"mcpServers":{"b":{"command":"b",},}}',
      `${BOM}{"mcpServers":{"c":{"command":"c"}}}`,
      '{"mcpServers":[{"command":"d"}]}'
    ]
    for (const text of cases) {
      expect(
        await readAntigravityConfiguredConnectors(
          await writeHome({ '.gemini/config/mcp_config.json': text })
        )
      ).toBeUndefined()
    }
    const home = await writeHome({
      '.gemini/config/mcp_config.json': '// note\n{"mcpServers":{}}',
      '.gemini/config/plugins/alpha/plugin.json': '{"name":"alpha"}',
      '.gemini/config/plugins/alpha/mcp_config.json': '{"mcpServers":{"s":{"command":"s"}}}'
    })
    expect((await readAntigravityConfiguredConnectors(home))?.servers).toEqual([
      { name: 'alpha_s', status: 'unknown', configured: true }
    ])
  })

  it('switches plugins off only through config.json, which tolerates a BOM and is ignored when unparseable', async () => {
    const plugins = {
      '.gemini/config/plugins/alpha/plugin.json': '{"name":"alpha"}',
      '.gemini/config/plugins/alpha/mcp_config.json': '{"mcpServers":{"s":{"command":"s"}}}',
      '.gemini/config/plugins/beta/plugin.json': '{"name":"beta","disabled":true}',
      '.gemini/config/plugins/beta/mcp_config.json': '{"mcpServers":{"t":{"command":"t"}}}'
    }
    expect((await readAntigravityConfiguredConnectors(await writeHome(plugins)))?.servers).toEqual([
      { name: 'alpha_s', status: 'unknown', configured: true },
      { name: 'beta_t', status: 'unknown', configured: true }
    ])
    const switched = await writeHome({
      ...plugins,
      '.gemini/config/config.json': `${BOM}{"plugins":{"beta":{"enabled":true},"alpha":{"enabled":false}}}`
    })
    expect((await readAntigravityConfiguredConnectors(switched))?.servers).toEqual([
      { name: 'alpha_s', status: 'disabled', configured: true },
      { name: 'beta_t', status: 'unknown', configured: true }
    ])
    const unparseable = await writeHome({ ...plugins, '.gemini/config/config.json': '{"plugins":' })
    expect(
      (await readAntigravityConfiguredConnectors(unparseable))?.servers.map(
        (server) => server.status
      )
    ).toEqual(['unknown', 'unknown'])
  })

  it('caps the list at the connector limit and skips names the snapshot cannot carry', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 1005 }, (_, index) => [`server-${index}`, { command: 'x' }])
    )
    const home = await writeHome({
      '.gemini/config/mcp_config.json': JSON.stringify({
        mcpServers: { ...many, ['n'.repeat(600)]: { command: 'long' } }
      })
    })
    const servers = (await readAntigravityConfiguredConnectors(home))?.servers ?? []
    expect(servers).toHaveLength(1000)
    expect(servers.every((server) => server.name.length <= 512)).toBe(true)
  })

  it('reports nothing for a home with no agy configuration', async () => {
    expect(await readAntigravityConfiguredConnectors(await writeHome({}))).toBeUndefined()
  })
})
