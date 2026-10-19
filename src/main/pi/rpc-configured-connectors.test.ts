import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readPiConfiguredConnectors } from './rpc-configured-connectors'

const dirs: string[] = []
async function agentDir(mcp?: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pi-mcp-'))
  dirs.push(dir)
  if (mcp !== undefined) {
    await writeFile(join(dir, 'mcp.json'), mcp)
  }
  return dir
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('readPiConfiguredConnectors', () => {
  it('lists configured servers as unknown, never connected, without their config', async () => {
    const snapshot = await readPiConfiguredConnectors(
      await agentDir(
        JSON.stringify({
          mcpServers: {
            engram: { command: 'engram', env: { TOKEN: 'secret' } },
            off: { url: 'https://x.test', disabled: true }
          }
        })
      )
    )
    expect(snapshot?.servers).toEqual([
      { name: 'engram', status: 'unknown', configured: true },
      { name: 'off', status: 'disabled', configured: true }
    ])
    expect(JSON.stringify(snapshot)).not.toContain('secret')
  })

  it('reports nothing for a missing, malformed or empty file', async () => {
    expect(await readPiConfiguredConnectors(await agentDir())).toBeUndefined()
    expect(await readPiConfiguredConnectors(await agentDir('{nope'))).toBeUndefined()
    expect(await readPiConfiguredConnectors(await agentDir('{"mcpServers":{}}'))).toBeUndefined()
    expect(await readPiConfiguredConnectors(await agentDir('[]'))).toBeUndefined()
  })
})
