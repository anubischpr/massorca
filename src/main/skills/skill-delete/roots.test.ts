import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../claude-plugin-skill-sources-wsl', () => ({
  discoverClaudePluginSkillSourcesInWsl: vi.fn().mockResolvedValue([])
}))
import { discoverClaudePluginSkillSourcesInWsl } from '../claude-plugin-skill-sources-wsl'
import { blockedCanonicalReason } from './guards'
import { buildSkillDeleteRootSet } from './roots'

describe('native skill deletion root ownership', () => {
  it('owns the Antigravity plugin skill folders of a workspace-scoped target, as plugin roots', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-delete-roots-'))
    try {
      await mkdir(join(home, '.gemini', 'config', 'plugins', 'alpha'), { recursive: true })
      await writeFile(join(home, '.gemini', 'config', 'plugins', 'alpha', 'plugin.json'), '{}')
      const pluginSkills = join(home, '.gemini', 'config', 'plugins', 'alpha', 'skills')
      const scoped = await buildSkillDeleteRootSet({
        target: { kind: 'native-host', cwd: home },
        repos: [],
        homeDir: home
      })
      expect(scoped.roots).toContainEqual(
        expect.objectContaining({ path: pluginSkills, sourceKind: 'plugin', namePrefix: 'alpha' })
      )
      // The guard refuses a plugin-kind root's skill, which is why the plugin roots are owned at all.
      expect(
        blockedCanonicalReason(join(pluginSkills, 'a-one'), {
          semantics: scoped.semantics,
          roots: scoped.roots
        })
      ).toBe('plugin')
      const untargeted = await buildSkillDeleteRootSet({
        target: { kind: 'native-host', cwd: undefined },
        repos: [],
        homeDir: home
      })
      expect(untargeted.roots.map((root) => root.path)).not.toContain(pluginSkills)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})

describe('WSL skill deletion root ownership', () => {
  it('uses the guest home for an omitted cwd, preserving the prior resolved target', async () => {
    const target = {
      kind: 'wsl' as const,
      distro: 'Ubuntu',
      homeDir: '/home/alice',
      cwd: undefined
    }
    const omitted = await buildSkillDeleteRootSet({ target, repos: [] })
    const explicit = await buildSkillDeleteRootSet({
      target: { ...target, cwd: target.homeDir },
      repos: []
    })
    expect(omitted.roots).toEqual(explicit.roots)
    expect(omitted.roots.every((root) => root.path.startsWith('/home/alice/'))).toBe(true)
    expect(discoverClaudePluginSkillSourcesInWsl).toHaveBeenCalledWith({
      distro: 'Ubuntu',
      homeDir: '/home/alice',
      cwd: '/home/alice'
    })
  })
})
