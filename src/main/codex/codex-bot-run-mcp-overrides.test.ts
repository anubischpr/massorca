import { describe, expect, it } from 'vitest'
import type { BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { codexBotRunMcpOverrideArgs } from './codex-bot-run-mcp-overrides'

const DENIAL: BotRunDenial = {
  mcpServers: ['engram', 'openmetadata', 'open-metadata.dev'],
  envNames: [],
  envPrefixes: []
}
const reading = (config: string) => async () => config

describe('codexBotRunMcpOverrideArgs', () => {
  it('disables only the denied servers the account config already holds', async () => {
    const config = '[mcp_servers.engram]\ncommand = "engram"\n[mcp_servers.other]\ncommand = "x"\n'
    expect(await codexBotRunMcpOverrideArgs(DENIAL, '/home/.codex', reading(config))).toEqual([
      '-c',
      'mcp_servers.engram.enabled=false'
    ])
  })

  it('quotes a server name a bare TOML key cannot hold', async () => {
    const config = '[mcp_servers."open-metadata.dev"]\nurl = "https://example.test"\n'
    expect(await codexBotRunMcpOverrideArgs(DENIAL, '/home/.codex', reading(config))).toEqual([
      '-c',
      'mcp_servers."open-metadata.dev".enabled=false'
    ])
  })

  it('adds nothing for a server the config lacks: an unknown one would break the config load', async () => {
    expect(await codexBotRunMcpOverrideArgs(DENIAL, '/home/.codex', reading(''))).toEqual([])
  })

  it('adds nothing without a denial, without a home, or when the config is unreadable or inline', async () => {
    const config = '[mcp_servers.engram]\ncommand = "engram"\n'
    expect(await codexBotRunMcpOverrideArgs(null, '/h', reading(config))).toEqual([])
    expect(await codexBotRunMcpOverrideArgs(DENIAL, null, reading(config))).toEqual([])
    expect(
      await codexBotRunMcpOverrideArgs(DENIAL, '/h', async () => {
        throw new Error('ENOENT')
      })
    ).toEqual([])
    expect(
      await codexBotRunMcpOverrideArgs(DENIAL, '/h', reading('mcp_servers = { engram = {} }'))
    ).toEqual([])
  })

  it('reads config.toml of the given home', async () => {
    const seen: string[] = []
    await codexBotRunMcpOverrideArgs(DENIAL, '/home/.codex', async (path) => {
      seen.push(path.replaceAll('\\', '/'))
      return ''
    })
    expect(seen).toEqual(['/home/.codex/config.toml'])
  })
})
