import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { designSystemFolderToGrant } from './native-chat-design-system-grant'

let sandbox: string

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'orca-design-grant-'))
})

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

async function linkedWorktree(): Promise<{ main: string; worktree: string }> {
  const main = join(sandbox, 'main')
  await mkdir(join(main, '.git', 'worktrees', 'wt'), { recursive: true })
  const worktree = join(sandbox, 'wt')
  await mkdir(worktree)
  await writeFile(join(worktree, '.git'), `gitdir: ${join(main, '.git', 'worktrees', 'wt')}\n`)
  return { main, worktree }
}

describe('designSystemFolderToGrant', () => {
  it('grants the main checkout folder to an agent launched in a linked worktree, and makes it', async () => {
    const { main, worktree } = await linkedWorktree()
    const folder = await designSystemFolderToGrant(worktree)
    expect(folder).toBe(join(main, 'design', 'system'))
    expect((await stat(join(main, 'design', 'system'))).isDirectory()).toBe(true)
  })

  it('grants nothing when the launch directory already holds the folder', async () => {
    const repo = join(sandbox, 'repo')
    await mkdir(join(repo, '.git'), { recursive: true })
    expect(await designSystemFolderToGrant(repo)).toBeNull()
    await expect(stat(join(repo, 'design'))).rejects.toThrow()
  })

  it('grants the worktree copy of a system written there before systems were shared', async () => {
    const { main, worktree } = await linkedWorktree()
    await mkdir(join(worktree, 'design', 'system'), { recursive: true })
    await writeFile(join(worktree, 'design', 'system', 'tokens.json'), '{}')
    expect(await designSystemFolderToGrant(worktree)).toBeNull()
    await expect(stat(join(main, 'design'))).rejects.toThrow()
  })
})
