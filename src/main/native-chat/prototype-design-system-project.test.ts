import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveDesignSystemProject } from './prototype-design-system-project'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'orca-design-project-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

describe('resolveDesignSystemProject', () => {
  it('uses the nearest ancestor with a .git folder and names it for its folder', async () => {
    const repo = join(sandbox, 'nexuscare')
    const nested = join(repo, 'packages', 'app')
    await mkdir(join(repo, '.git'), { recursive: true })
    await mkdir(nested, { recursive: true })
    const project = await resolveDesignSystemProject(nested)
    expect(project.root).toBe(repo)
    expect(project.projectName).toBe('nexuscare')
  })

  it('prefers the nearest .git over a further one', async () => {
    const outer = join(sandbox, 'outer')
    const inner = join(outer, 'inner')
    await mkdir(join(outer, '.git'), { recursive: true })
    await mkdir(join(inner, '.git'), { recursive: true })
    expect((await resolveDesignSystemProject(join(inner, 'src'))).root).toBe(inner)
  })

  it('uses the launch directory itself for a folder workspace without git', async () => {
    const folder = join(sandbox, 'notes-workspace')
    await mkdir(folder)
    const project = await resolveDesignSystemProject(folder)
    expect(project.root).toBe(folder)
    expect(project.projectName).toBe('notes-workspace')
  })

  it('names a linked worktree for its main repository, and keeps its own root', async () => {
    const worktree = join(sandbox, 'worktrees', 'feature-x')
    await mkdir(worktree, { recursive: true })
    const gitdir = join(sandbox, 'massorca', '.git', 'worktrees', 'feature-x')
    await writeFile(join(worktree, '.git'), `gitdir: ${gitdir}\n`)
    const project = await resolveDesignSystemProject(join(worktree, 'src'))
    expect(project.root).toBe(worktree)
    expect(project.projectName).toBe('massorca')
  })

  it('reads a Windows-style gitdir line', async () => {
    const worktree = join(sandbox, 'wt')
    await mkdir(worktree)
    await writeFile(
      join(worktree, '.git'),
      'gitdir: D:\\projects\\massorca\\.git\\worktrees\\prototypes-section-f8edf5\r\n'
    )
    expect((await resolveDesignSystemProject(worktree)).projectName).toBe('massorca')
  })

  it('names a submodule or an unreadable .git file for its own folder', async () => {
    const submodule = join(sandbox, 'sub')
    await mkdir(submodule)
    await writeFile(join(submodule, '.git'), 'gitdir: ../.git/modules/sub\n')
    expect((await resolveDesignSystemProject(submodule)).projectName).toBe('sub')

    const odd = join(sandbox, 'odd')
    await mkdir(odd)
    await writeFile(join(odd, '.git'), 'not a pointer')
    expect((await resolveDesignSystemProject(odd)).projectName).toBe('odd')
  })

  it('gives each root its own stable key', async () => {
    const left = join(sandbox, 'left')
    const right = join(sandbox, 'right')
    await mkdir(join(left, '.git'), { recursive: true })
    await mkdir(join(right, '.git'), { recursive: true })
    const first = await resolveDesignSystemProject(left)
    expect(first.projectKey).toMatch(/^[0-9a-f]{16}$/u)
    expect((await resolveDesignSystemProject(join(left, 'a'))).projectKey).toBe(first.projectKey)
    expect((await resolveDesignSystemProject(right)).projectKey).not.toBe(first.projectKey)
  })

  it('still answers for a launch directory that does not exist', async () => {
    const missing = join(sandbox, 'gone')
    const project = await resolveDesignSystemProject(missing)
    expect(project.projectName).toBe('gone')
  })
})
