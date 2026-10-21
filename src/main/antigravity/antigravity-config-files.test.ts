import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readAntigravityPlugins } from './antigravity-config-files'

const BOM = String.fromCharCode(0xfeff)
const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

/** Writes files under a fresh agy config directory; keys are paths relative to it. */
async function writeConfig(files: Record<string, string>): Promise<string> {
  const configDir = await mkdtemp(join(tmpdir(), 'agy-config-'))
  dirs.push(configDir)
  for (const [path, text] of Object.entries(files)) {
    const file = join(configDir, ...path.split('/'))
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, text)
  }
  return configDir
}

describe('readAntigravityPlugins', () => {
  it('lists each plugin with a plugin.json, its switch from config.json and its manifest name', async () => {
    const configDir = await writeConfig({
      'plugins/alpha/plugin.json': '{"name":"alpha-core"}',
      'plugins/beta/plugin.json': `${BOM}{"name":"  "}`,
      'plugins/gamma/plugin.json': '{"name":"gamma"}',
      'plugins/no-manifest/skills/x/SKILL.md': '---\nname: x\n---\n',
      'config.json': `${BOM}{"plugins":{"beta":{"enabled":false},"gamma":{"enabled":true}}}`
    })
    const plugins = await readAntigravityPlugins(configDir)
    expect(
      plugins.map(({ directory, enabled, manifestName }) => ({ directory, enabled, manifestName }))
    ).toEqual([
      { directory: 'alpha', enabled: true, manifestName: 'alpha-core' },
      { directory: 'beta', enabled: false, manifestName: null },
      { directory: 'gamma', enabled: true, manifestName: 'gamma' }
    ])
    expect(plugins[0]?.path).toBe(join(configDir, 'plugins', 'alpha'))
  })

  it('keeps every plugin on when config.json is missing or unparseable, and ignores an unreadable manifest name', async () => {
    const configDir = await writeConfig({
      'plugins/alpha/plugin.json': '// note\n{"name":"alpha"}',
      'plugins/beta/plugin.json': '{"name":"beta"}',
      'config.json': '{"plugins":'
    })
    const plugins = await readAntigravityPlugins(configDir)
    expect(plugins.map(({ enabled, manifestName }) => ({ enabled, manifestName }))).toEqual([
      { enabled: true, manifestName: null },
      { enabled: true, manifestName: 'beta' }
    ])
    expect(await readAntigravityPlugins(join(configDir, 'absent'))).toEqual([])
  })
})
