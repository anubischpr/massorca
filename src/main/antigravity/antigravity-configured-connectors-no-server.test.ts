import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { antigravityNamesNoMcpServer } from './antigravity-configured-connectors'

const tmpDirs: string[] = []
afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function homeWith(files: Record<string, string>): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'agy-no-mcp-'))
  tmpDirs.push(home)
  for (const [relative, text] of Object.entries(files)) {
    const file = join(home, relative)
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, text)
  }
  return home
}

describe('antigravityNamesNoMcpServer', () => {
  it('allows a code turn when no MCP config file exists at all', async () => {
    expect(await antigravityNamesNoMcpServer(await homeWith({}))).toBe(true)
  })

  it('allows a code turn when the global and plugin configs name no server', async () => {
    const home = await homeWith({
      '.gemini/config/mcp_config.json': JSON.stringify({ mcpServers: {} }),
      '.gemini/config/plugins/p1/plugin.json': JSON.stringify({ name: 'p1' }),
      '.gemini/config/plugins/p1/mcp_config.json': JSON.stringify({ mcpServers: {} })
    })
    expect(await antigravityNamesNoMcpServer(home)).toBe(true)
  })

  it('refuses a code turn when the global config names any server, even a disabled one', async () => {
    const home = await homeWith({
      '.gemini/config/mcp_config.json': JSON.stringify({
        mcpServers: { engram: { command: 'x', disabled: true } }
      })
    })
    expect(await antigravityNamesNoMcpServer(home)).toBe(false)
  })

  it('refuses a code turn when a plugin config names a server', async () => {
    const home = await homeWith({
      '.gemini/config/plugins/p1/plugin.json': JSON.stringify({ name: 'p1' }),
      '.gemini/config/plugins/p1/mcp_config.json': JSON.stringify({
        mcpServers: { write: { command: 'x' } }
      })
    })
    expect(await antigravityNamesNoMcpServer(home)).toBe(false)
  })

  it('refuses a code turn when an MCP config exists but cannot be read', async () => {
    const home = await homeWith({ '.gemini/config/mcp_config.json': '{ "mcpServers": {, }' })
    expect(await antigravityNamesNoMcpServer(home)).toBe(false)
  })
})
