import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectMarketplaceItems, resolveEngramStorePath } from './marketplace-detection'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'marketplace-detect-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('detectMarketplaceItems', () => {
  it('reports the CLI, the store and each agent entry', async () => {
    const store = join(dir, '.engram')
    mkdirSync(store)
    writeFileSync(
      join(dir, '.claude.json'),
      JSON.stringify({ mcpServers: { engram: {}, openmetadata: {} } })
    )
    writeFileSync(join(dir, 'config.toml'), '[mcp_servers.openmetadata-escritura]\ncommand = "x"\n')
    const detection = await detectMarketplaceItems({
      commandOnPath: async (command) => command === 'engram',
      storePath: () => store,
      configPath: (agent) => join(dir, agent === 'claude' ? '.claude.json' : 'config.toml')
    })
    expect(detection).toEqual({
      engram: { cli: 'found', store: 'found', agents: { claude: 'set', codex: 'missing' } },
      openMetadata: {
        agents: {
          claude: { reader: 'set', writer: 'missing' },
          codex: { reader: 'missing', writer: 'set' }
        }
      }
    })
  })

  it('reports missing pieces and unreadable configs', async () => {
    writeFileSync(join(dir, '.claude.json'), '{oops')
    const detection = await detectMarketplaceItems({
      commandOnPath: async () => false,
      storePath: () => join(dir, 'nowhere'),
      configPath: (agent) => join(dir, agent === 'claude' ? '.claude.json' : 'absent.toml')
    })
    expect(detection.engram).toEqual({
      cli: 'missing',
      store: 'missing',
      agents: { claude: 'unreadable', codex: 'missing' }
    })
    expect(detection.openMetadata.agents.claude).toEqual({
      reader: 'unreadable',
      writer: 'unreadable'
    })
  })
})

describe('resolveEngramStorePath', () => {
  it('prefers ENGRAM_DATA_DIR', () => {
    expect(resolveEngramStorePath({ ENGRAM_DATA_DIR: ' /data/engram ' })).toBe('/data/engram')
    expect(resolveEngramStorePath({})).toMatch(/\.engram$/)
  })
})
