import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  projectsOfLaunchDirectories,
  readDesignSystemFiles,
  readDesignSystemOfLaunchDirectory,
  readDesignSystemVersion
} from './prototype-design-system-files'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-design-files-'))
  await mkdir(join(root, '.git'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function write(name: string, text: string): Promise<void> {
  await mkdir(join(root, 'design', 'system'), { recursive: true })
  await writeFile(join(root, 'design', 'system', name), text)
}

const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 3 } }
})

describe('readDesignSystemFiles', () => {
  it('reads the three files that exist and leaves out the rest', async () => {
    await write('tokens.json', TOKENS)
    await write('system.md', '# rules')
    expect(await readDesignSystemFiles(root)).toEqual({
      files: { tokensJson: TOKENS, systemMd: '# rules' },
      unreadableFileNames: []
    })
  })

  it('answers with nothing for a project without design/system', async () => {
    expect(await readDesignSystemFiles(root)).toEqual({ files: {}, unreadableFileNames: [] })
  })

  it('leaves out a file over the size cap and a file that is not text, and names them as unreadable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await write('tokens.json', 'x'.repeat(600 * 1024))
      await write('components.html', '\u0000binary')
      expect(await readDesignSystemFiles(root)).toEqual({
        files: {},
        unreadableFileNames: ['design/system/tokens.json', 'design/system/components.html']
      })
    } finally {
      warn.mockRestore()
    }
  })

  it('does not follow a symlink to a file outside the folder', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await write('tokens.json', TOKENS)
      const outside = join(root, 'outside.md')
      await writeFile(outside, 'secret')
      await symlink(outside, join(root, 'design', 'system', 'system.md')).catch(() => undefined)
      expect((await readDesignSystemFiles(root)).files.systemMd).toBeUndefined()
    } finally {
      warn.mockRestore()
    }
  })

  it('does not follow a design folder that is a symlink', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const elsewhere = join(root, 'elsewhere')
      await mkdir(join(elsewhere, 'system'), { recursive: true })
      await writeFile(join(elsewhere, 'system', 'tokens.json'), TOKENS)
      await symlink(elsewhere, join(root, 'design'), 'junction').catch(() => undefined)
      expect((await readDesignSystemFiles(root)).files).toEqual({})
    } finally {
      warn.mockRestore()
    }
  })
})

describe('readDesignSystemOfLaunchDirectory', () => {
  it('lists the root-relative names of the files it read', async () => {
    await write('tokens.json', TOKENS)
    await write('components.html', '<section data-component="A"></section>')
    const result = await readDesignSystemOfLaunchDirectory(join(root, 'src'))
    expect(result).toMatchObject({
      ok: true,
      fileNames: ['design/system/tokens.json', 'design/system/components.html'],
      tokensJson: TOKENS
    })
  })

  it('names an over-cap file as unreadable and logs its name and reason, not as absent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await write('tokens.json', 'x'.repeat(600 * 1024))
      const result = await readDesignSystemOfLaunchDirectory(root)
      expect(result).toMatchObject({
        ok: true,
        fileNames: [],
        unreadableFileNames: ['design/system/tokens.json']
      })
      expect(result).not.toHaveProperty('tokensJson')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(
        '[prototypes] design system file tokens.json was not read: too_large'
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('logs an unreadable file once per version, not on every read, and again when it changes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await write('tokens.json', 'x'.repeat(600 * 1024))
      await readDesignSystemOfLaunchDirectory(root)
      await readDesignSystemOfLaunchDirectory(root)
      expect(warn).toHaveBeenCalledTimes(1)
      await write('tokens.json', 'x'.repeat(700 * 1024))
      await readDesignSystemOfLaunchDirectory(root)
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      warn.mockRestore()
    }
  })

  it('reports no unreadable names for a project whose files are all absent or read', async () => {
    await write('tokens.json', TOKENS)
    const result = await readDesignSystemOfLaunchDirectory(root)
    expect(result).not.toHaveProperty('unreadableFileNames')
  })
})

describe('readDesignSystemVersion', () => {
  it('reads the version of tokens.json', async () => {
    await write('tokens.json', TOKENS)
    expect(await readDesignSystemVersion(root)).toBe(3)
  })

  it('reads a missing version as 1 and gives none without a valid tokens.json', async () => {
    await write('tokens.json', '{}')
    expect(await readDesignSystemVersion(root)).toBe(1)
    await write('tokens.json', 'not json')
    expect(await readDesignSystemVersion(root)).toBeUndefined()
    await rm(join(root, 'design'), { recursive: true })
    expect(await readDesignSystemVersion(root)).toBeUndefined()
  })
})

describe('projectsOfLaunchDirectories', () => {
  it('reads one summary per root for many launch directories', async () => {
    await write('tokens.json', TOKENS)
    const other = await mkdtemp(join(tmpdir(), 'orca-design-other-'))
    try {
      const listed = await projectsOfLaunchDirectories([root, join(root, 'src'), other])
      expect(listed.get(root)?.system).toMatchObject({ version: 3, tokenCount: 1 })
      expect(listed.get(join(root, 'src'))?.projectKey).toBe(listed.get(root)?.projectKey)
      expect(listed.get(other)?.system).toBeUndefined()
      expect(listed.size).toBe(3)
    } finally {
      await rm(other, { recursive: true, force: true })
    }
  })

  it('leaves a project with an invalid tokens.json without a summary', async () => {
    await write('tokens.json', '[1]')
    expect((await projectsOfLaunchDirectories([root])).get(root)?.system).toBeUndefined()
  })
})
