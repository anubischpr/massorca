import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PiRpcCommandCatalog } from './rpc-command-catalog'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
async function scratch(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'orca-pi-commands-'))
  directories.push(directory)
  return join(directory, 'pi-slash-commands.json')
}

describe('Pi runtime command catalog', () => {
  it('keeps each runtime separate and ignores an empty report', () => {
    const catalog = new PiRpcCommandCatalog()
    const onChange = vi.fn()
    catalog.onChange(onChange)
    catalog.record('gentle-shell', [{ name: 'gentle:jobs', kind: 'command' }])
    catalog.record('gentle-shell', [{ name: 'gentle:jobs', kind: 'command' }])
    catalog.record('pi', [])
    expect(catalog.read('gentle-shell')).toEqual([{ name: 'gentle:jobs', kind: 'command' }])
    expect(catalog.read('pi')).toBeUndefined()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('survives a restart and lets a fresh report win over the saved one', async () => {
    const file = await scratch()
    const first = new PiRpcCommandCatalog(file)
    first.record('gentle-shell', [
      { name: 'gentle:jobs', kind: 'command', description: 'Jobs' },
      { name: 'skill:review', kind: 'skill', kindUnspecified: true }
    ])
    await first.flush()
    const second = new PiRpcCommandCatalog(file)
    const onChange = vi.fn()
    second.onChange(onChange)
    await vi.waitFor(() => expect(second.read('gentle-shell')).toHaveLength(2))
    expect(second.read('gentle-shell')?.[0]).toEqual({
      name: 'gentle:jobs',
      kind: 'command',
      description: 'Jobs'
    })
    expect(onChange).toHaveBeenCalledTimes(1)

    const third = new PiRpcCommandCatalog(file)
    third.record('gentle-shell', [{ name: 'gentle:status', kind: 'command' }])
    await third.flush()
    await vi.waitFor(async () =>
      expect(JSON.parse(await readFile(file, 'utf8')).runtimes['gentle-shell']).toEqual([
        { name: 'gentle:status', kind: 'command' }
      ])
    )
  })

  it('treats an unreadable or foreign file as empty', async () => {
    const file = await scratch()
    await writeFile(file, '{"version":99,"runtimes":{"gentle-shell":[{"name":"x"}]}}')
    const catalog = new PiRpcCommandCatalog(file)
    await catalog.flush()
    expect(catalog.read('gentle-shell')).toBeUndefined()
    await writeFile(file, 'not json')
    await expect(new PiRpcCommandCatalog(file).flush()).resolves.toBeUndefined()
  })
})
