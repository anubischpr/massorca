import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverSkills } from './discovery'

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, ...path.split('/'))
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, text)
  }
}

function skill(name: string, extra = ''): string {
  return `---\nname: ${name}\ndescription: ${name} skill.\n${extra}---\n`
}

describe('Antigravity plugin skills', () => {
  it('lists the skills of each plugin agy has switched on as plugin:skill, never a plugin it has not loaded', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-agy-plugin-home-'))
    const workspace = await mkdtemp(join(tmpdir(), 'orca-agy-plugin-cwd-'))
    dirs.push(home, workspace)
    const plugins = join(home, '.gemini', 'config', 'plugins')
    await writeFiles(home, {
      '.gemini/config/config.json': JSON.stringify({ plugins: { off: { enabled: false } } }),
      '.gemini/config/plugins/alpha/plugin.json': '{"name":"alpha"}',
      '.gemini/config/plugins/alpha/skills/a-one/SKILL.md': skill('a-one'),
      '.gemini/config/plugins/alpha/skills/a-hidden/SKILL.md': skill(
        'a-hidden',
        'disable-slash-command: true\n'
      ),
      '.gemini/config/plugins/gamma/plugin.json': '{"name":"gamma-core"}',
      '.gemini/config/plugins/gamma/skills/g-one/SKILL.md': '---\ndescription: Unnamed.\n---\n',
      '.gemini/config/plugins/prefixed/plugin.json': '{"name":"prefixed"}',
      '.gemini/config/plugins/prefixed/skills/p-one/SKILL.md': skill('prefixed:p-one'),
      '.gemini/config/plugins/unsafe/plugin.json': '{"name":"Unsafe Name"}',
      '.gemini/config/plugins/unsafe/skills/u-one/SKILL.md': skill('u-one'),
      '.gemini/config/plugins/off/plugin.json': '{"name":"off"}',
      '.gemini/config/plugins/off/skills/o-one/SKILL.md': skill('o-one'),
      '.gemini/config/plugins/no-manifest/skills/n-one/SKILL.md': skill('n-one'),
      '.gemini/antigravity-cli/plugins/legacy/plugin.json': '{"name":"legacy"}',
      '.gemini/antigravity-cli/plugins/legacy/skills/l-one/SKILL.md': skill('l-one')
    })

    const result = await discoverSkills({ homeDir: home, cwd: workspace, repos: [] })
    const pluginSkills = result.skills.filter((entry) => entry.sourceKind === 'plugin')
    expect(pluginSkills.map((entry) => entry.name).sort()).toEqual([
      'alpha:a-hidden',
      'alpha:a-one',
      'gamma-core:g-one',
      'prefixed:p-one',
      'unsafe:u-one'
    ])
    expect(pluginSkills.find((entry) => entry.name === 'alpha:a-hidden')).toMatchObject({
      disableSlashCommand: true,
      providers: ['agent-skills'],
      rootPaths: [join(plugins, 'alpha', 'skills')]
    })
    expect(pluginSkills.find((entry) => entry.name === 'alpha:a-one')).not.toHaveProperty(
      'disableSlashCommand'
    )
    expect(result.sources.filter((source) => source.namePrefix)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^antigravity-plugin-/u),
          namePrefix: 'alpha',
          owner: 'antigravity',
          sourceKind: 'plugin',
          exists: true
        })
      ])
    )
  })

  it('offers plugin skills only for a workspace-scoped scan, as the Claude plugins are', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-agy-plugin-untargeted-'))
    dirs.push(home)
    await writeFiles(home, {
      '.gemini/config/plugins/alpha/plugin.json': '{"name":"alpha"}',
      '.gemini/config/plugins/alpha/skills/a-one/SKILL.md': skill('a-one')
    })
    const untargeted = await discoverSkills({ homeDir: home, repos: [] })
    expect(untargeted.skills.map((entry) => entry.name)).not.toContain('alpha:a-one')
    const plugin = await discoverSkills({
      homeDir: home,
      repos: [],
      cwd: home,
      sourceKinds: ['home']
    })
    expect(plugin.skills.map((entry) => entry.name)).not.toContain('alpha:a-one')
  })
})
