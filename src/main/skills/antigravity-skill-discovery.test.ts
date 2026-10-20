import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSkillDiscoverySources, discoverSkills } from './discovery'

describe('Antigravity global skill discovery', () => {
  it('attributes a skill in the CLI configuration directory to Antigravity', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-agy-skills-'))
    try {
      const root = join(home, '.gemini', 'config', 'skills')
      const directory = join(root, 'review')
      await mkdir(directory, { recursive: true })
      await writeFile(
        join(directory, 'SKILL.md'),
        '---\nname: review\ndescription: Review a change.\n---\n'
      )
      const result = await discoverSkills({
        homeDir: home,
        includeCwd: false,
        providerRootOverrides: {}
      })
      expect(result.skills.find((skill) => skill.name === 'review')?.rootPaths).toContain(root)
      expect(result.sources.find((source) => source.id === 'home-antigravity')).toMatchObject({
        path: root,
        owner: 'antigravity',
        exists: true
      })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it.each([
    { pathApi: posix, home: '/home/remote', expected: '/home/remote/.gemini/config/skills' },
    {
      pathApi: win32,
      home: 'C:\\Users\\remote',
      expected: 'C:\\Users\\remote\\.gemini\\config\\skills'
    }
  ])('uses the execution host path format: $expected', ({ pathApi, home, expected }) => {
    const roots = buildSkillDiscoverySources({ homeDir: home, pathApi, includeCwd: false })
    expect(roots.find((root) => root.id === 'home-antigravity')).toMatchObject({
      path: expected,
      owner: 'antigravity'
    })
  })

  it('offers the skills the CLI ships in its builtin directory, which deletion never removes', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-agy-builtin-skills-'))
    try {
      const root = join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills')
      await mkdir(join(root, 'run-workflow'), { recursive: true })
      await writeFile(
        join(root, 'run-workflow', 'SKILL.md'),
        '---\nname: run-workflow\ndescription: Write and run a workflow.\n---\n'
      )
      // The CLI keeps this one out of its own `/` menu, and Orca follows that flag.
      await mkdir(join(root, 'ui-plugin-navigation'), { recursive: true })
      await writeFile(
        join(root, 'ui-plugin-navigation', 'SKILL.md'),
        '---\nname: ui-plugin-navigation\ndisable-slash-command: true\n---\n'
      )
      const result = await discoverSkills({
        homeDir: home,
        includeCwd: false,
        providerRootOverrides: {}
      })
      expect(
        result.sources.find((source) => source.id === 'home-antigravity-builtin')
      ).toMatchObject({ path: root, owner: 'antigravity', sourceKind: 'plugin', exists: true })
      expect(result.skills.find((skill) => skill.name === 'run-workflow')).toMatchObject({
        sourceKind: 'plugin',
        description: 'Write and run a workflow.'
      })
      expect(result.skills.find((skill) => skill.name === 'ui-plugin-navigation')).toMatchObject({
        disableSlashCommand: true
      })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('offers the skills the user installs in the CLI directory as Antigravity home skills', async () => {
    const home = await mkdtemp(join(tmpdir(), 'orca-agy-user-skills-'))
    try {
      const root = join(home, '.gemini', 'antigravity-cli', 'skills')
      await mkdir(join(root, 'go-testing'), { recursive: true })
      await writeFile(
        join(root, 'go-testing', 'SKILL.md'),
        '---\nname: go-testing\ndescription: Go test patterns.\n---\n'
      )
      const result = await discoverSkills({
        homeDir: home,
        includeCwd: false,
        providerRootOverrides: {}
      })
      expect(result.sources.find((source) => source.id === 'home-antigravity-cli')).toMatchObject({
        path: root,
        owner: 'antigravity',
        sourceKind: 'home',
        exists: true
      })
      expect(result.skills.find((skill) => skill.name === 'go-testing')).toMatchObject({
        sourceKind: 'home',
        description: 'Go test patterns.'
      })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it.each([
    {
      pathApi: posix,
      home: '/home/remote',
      expected: '/home/remote/.gemini/antigravity-cli/builtin/skills'
    },
    {
      pathApi: win32,
      home: 'C:\\Users\\remote',
      expected: 'C:\\Users\\remote\\.gemini\\antigravity-cli\\builtin\\skills'
    }
  ])(
    'locates the built-in skills on the execution host: $expected',
    ({ pathApi, home, expected }) => {
      const roots = buildSkillDiscoverySources({ homeDir: home, pathApi, includeCwd: false })
      expect(roots.find((root) => root.id === 'home-antigravity-builtin')).toMatchObject({
        path: expected,
        owner: 'antigravity',
        sourceKind: 'plugin'
      })
    }
  )
})
