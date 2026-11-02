import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listQuickOpenFiles } from '../ipc/filesystem-list-files'

// The team's folder is a folder workspace, not a git checkout: Files lists it with the host's own listing.
describe('listing the folder of a team', () => {
  let folder: string | undefined

  afterEach(async () => {
    if (folder) {
      await rm(folder, { recursive: true, force: true })
    }
    folder = undefined
  })

  it('lists files of a folder workspace that is not a git repository', async () => {
    folder = await mkdtemp(path.join(tmpdir(), 'bot-team-files-'))
    await mkdir(path.join(folder, 'brand'))
    await writeFile(path.join(folder, 'flyer.html'), '<p>Summer</p>')
    await writeFile(path.join(folder, 'brand', 'notes.md'), 'Colors')
    const store = {
      getRepos: () => [],
      getSettings: () => ({}),
      getProjectGroups: () => [
        { id: 'group', name: 'Bot teams', parentPath: path.dirname(folder!) }
      ],
      getFolderWorkspaces: () => [
        { id: 'team', projectGroupId: 'group', name: 'Marketing', folderPath: folder! }
      ]
    }

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the double provides the Store methods that root authorization reads.
    const files = await listQuickOpenFiles(folder, store as never)

    expect(files.sort()).toEqual(['brand/notes.md', 'flyer.html'])
  })

  it('refuses a folder that no workspace owns', async () => {
    folder = await mkdtemp(path.join(tmpdir(), 'bot-team-files-'))
    const store = {
      getRepos: () => [],
      getSettings: () => ({}),
      getProjectGroups: () => [],
      getFolderWorkspaces: () => []
    }

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the double provides the Store methods that root authorization reads.
    await expect(listQuickOpenFiles(folder, store as never)).rejects.toThrow()
  })
})
