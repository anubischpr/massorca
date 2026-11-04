import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDesignTokens } from '../../shared/prototype-design-system-tokens'
import {
  listDesignSystemVersionsOfLaunchDirectory,
  readDesignSystemVersionOfLaunchDirectory,
  restoreDesignSystemVersionOfLaunchDirectory
} from './prototype-design-system-versions'

let stateDirectory: string
let root: string

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-design-versions-state-'))
  root = await mkdtemp(join(tmpdir(), 'orca-design-versions-root-'))
  await mkdir(join(root, '.git'))
})

afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(root, { recursive: true, force: true })
})

/** Replaces the design system files of the project; a file not named is removed from disk. */
async function writeSystem(files: Record<string, string>): Promise<void> {
  const folder = join(root, 'design', 'system')
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(folder, name), text)
  }
}

async function present(name: string): Promise<boolean> {
  return stat(join(root, 'design', 'system', name)).then(
    () => true,
    () => false
  )
}

function tokensAt(version: number, options: Record<string, unknown> = {}): string {
  return JSON.stringify({
    color: {
      primary: { $value: version === 1 ? '#111111' : version === 2 ? '#222222' : '#333333' }
    },
    $extensions: { massorca: { version, status: 'detected', ...options } }
  })
}

function list() {
  return listDesignSystemVersionsOfLaunchDirectory({ stateDirectory, launchDirectory: root })
}

function read(version: number) {
  return readDesignSystemVersionOfLaunchDirectory({
    stateDirectory,
    launchDirectory: root,
    version
  })
}

function restore(version: number, canAct = (): boolean => true) {
  return restoreDesignSystemVersionOfLaunchDirectory({
    stateDirectory,
    launchDirectory: root,
    version,
    canAct
  })
}

describe('design system version snapshots', () => {
  it('takes one snapshot per version and never overwrites it', async () => {
    await writeSystem({ 'tokens.json': tokensAt(3), 'components.html': '<p>old</p>' })
    expect(await read(3)).toEqual({
      ok: true,
      projectKey: expect.stringMatching(/^[0-9a-f]{16}$/u),
      projectName: expect.any(String),
      fileNames: ['design/system/tokens.json', 'design/system/components.html'],
      tokensJson: tokensAt(3),
      componentsHtml: '<p>old</p>'
    })
    await writeSystem({ 'tokens.json': tokensAt(3), 'components.html': '<p>edited</p>' })
    expect(await read(3)).toMatchObject({ ok: true, componentsHtml: '<p>old</p>' })
  })

  it('leaves a file the version lacks out of its snapshot', async () => {
    await writeSystem({ 'tokens.json': tokensAt(3) })
    const result = await read(3)
    expect(result).not.toHaveProperty('systemMd')
    expect(result).not.toHaveProperty('componentsHtml')
  })

  it('does not snapshot a project whose tokens.json is not valid', async () => {
    await writeSystem({ 'tokens.json': 'not json', 'components.html': '<p>x</p>' })
    expect(await list()).toEqual({ ok: true, versions: [] })
  })

  it('lists the earlier versions of the history as unsaved and the saved ones as saved, newest first', async () => {
    await writeSystem({ 'tokens.json': tokensAt(2) })
    await list()
    await writeSystem({
      'tokens.json': tokensAt(3, {
        updatedAt: '2026-10-29',
        history: [
          { version: 1, status: 'detected', at: '2026-10-21' },
          { version: 2, status: 'proposed', at: '2026-10-25' }
        ]
      })
    })
    expect(await list()).toEqual({
      ok: true,
      versions: [
        { version: 3, at: '2026-10-29', saved: true, current: true },
        { version: 2, at: '2026-10-25', saved: true, current: false },
        { version: 1, at: '2026-10-21', saved: false, current: false }
      ]
    })
  })

  it('opens a saved version and refuses one that was never saved', async () => {
    await writeSystem({
      'tokens.json': tokensAt(3, {
        history: [{ version: 1, status: 'detected', at: '2026-10-21' }]
      }),
      'components.html': '<p>three</p>'
    })
    expect(await read(1)).toEqual({ ok: false, error: 'not_found' })
    expect(await read(3)).toMatchObject({ ok: true, componentsHtml: '<p>three</p>' })
  })

  it('answers not_found for a version of a project with no system', async () => {
    expect(await read(1)).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('restoreDesignSystemVersionOfLaunchDirectory', () => {
  it('copies an earlier version into the next version, keeps history and snapshots the new one', async () => {
    await writeSystem({
      'tokens.json': tokensAt(1),
      'components.html': '<p>one</p>',
      'system.md': '# one'
    })
    await list()
    await writeSystem({
      'tokens.json': tokensAt(2, {
        history: [{ version: 1, status: 'detected', at: '2026-10-21' }]
      }),
      'components.html': '<p>two</p>'
    })
    await list()

    expect(await restore(1)).toEqual({ ok: true, version: 3 })

    expect(await readFile(join(root, 'design', 'system', 'components.html'), 'utf8')).toBe(
      '<p>one</p>'
    )
    expect(await readFile(join(root, 'design', 'system', 'system.md'), 'utf8')).toBe('# one')
    const restored = parseDesignTokens(
      await readFile(join(root, 'design', 'system', 'tokens.json'), 'utf8')
    )
    expect(restored?.meta.version).toBe(3)
    expect(restored?.tokens[0]?.value).toBe('#111111')
    expect(restored?.meta.history).toEqual([
      { version: 1, status: 'detected', at: '2026-10-21' },
      { version: 3, status: 'detected', at: expect.any(String), restoredFrom: 1 }
    ])
    expect(await read(3)).toMatchObject({ ok: true, componentsHtml: '<p>one</p>' })
    expect(await read(1)).toMatchObject({ ok: true, componentsHtml: '<p>one</p>' })
    expect(await read(2)).toMatchObject({ ok: true, componentsHtml: '<p>two</p>' })
  })

  it('removes a known file the restored version lacks, and leaves every other file in the folder', async () => {
    await writeSystem({ 'tokens.json': tokensAt(1) })
    await list()
    await writeSystem({
      'tokens.json': tokensAt(2),
      'components.html': '<p>two</p>',
      'system.md': '# two'
    })
    await writeFile(join(root, 'design', 'system', 'notes.md'), 'keep me')
    await list()

    expect(await restore(1)).toEqual({ ok: true, version: 3 })
    expect(await present('components.html')).toBe(false)
    expect(await present('system.md')).toBe(false)
    expect(await present('tokens.json')).toBe(true)
    expect(await readFile(join(root, 'design', 'system', 'notes.md'), 'utf8')).toBe('keep me')
  })

  it('keeps the current version before replacing it, even when no one listed it', async () => {
    await writeSystem({ 'tokens.json': tokensAt(1), 'components.html': '<p>one</p>' })
    await list()
    await writeSystem({ 'tokens.json': tokensAt(2), 'components.html': '<p>two</p>' })

    expect(await restore(1)).toEqual({ ok: true, version: 3 })
    expect(await read(2)).toMatchObject({ ok: true, componentsHtml: '<p>two</p>' })
  })

  it('refuses a restore when the current version cannot be kept first, and changes nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await writeSystem({ 'tokens.json': tokensAt(1), 'components.html': '<p>one</p>' })
      await list()
      const copies = join(stateDirectory, 'prototype-design-system-versions')
      await rm(copies, { recursive: true, force: true })
      await writeFile(copies, 'a file where the copies should be')
      await writeSystem({ 'tokens.json': tokensAt(2), 'components.html': '<p>two</p>' })

      expect(await restore(1)).toEqual({ ok: false, error: 'unwritable' })
      expect(await readFile(join(root, 'design', 'system', 'components.html'), 'utf8')).toBe(
        '<p>two</p>'
      )
      expect(
        parseDesignTokens(await readFile(join(root, 'design', 'system', 'tokens.json'), 'utf8'))
          ?.meta.version
      ).toBe(2)
      for (const call of warn.mock.calls) {
        expect(String(call[0])).not.toContain(root)
      }
    } finally {
      warn.mockRestore()
    }
  })

  it('refuses a restore over a tokens.json that is not a version, and changes nothing', async () => {
    await writeSystem({ 'tokens.json': tokensAt(1) })
    await list()
    await writeSystem({ 'tokens.json': 'not json', 'components.html': '<p>broken</p>' })

    expect(await restore(1)).toEqual({ ok: false, error: 'unwritable' })
    expect(await readFile(join(root, 'design', 'system', 'tokens.json'), 'utf8')).toBe('not json')
    expect(await readFile(join(root, 'design', 'system', 'components.html'), 'utf8')).toBe(
      '<p>broken</p>'
    )
  })

  it('refuses the current version, a version never saved, and a caller that may not act', async () => {
    await writeSystem({ 'tokens.json': tokensAt(1), 'components.html': '<p>one</p>' })
    await list()
    await writeSystem({ 'tokens.json': tokensAt(2), 'components.html': '<p>two</p>' })
    await list()

    expect(await restore(2)).toEqual({ ok: false, error: 'current' })
    expect(await restore(7)).toEqual({ ok: false, error: 'not_found' })
    expect(await restore(1, () => false)).toEqual({ ok: false, error: 'not_found' })

    const tokens = await readFile(join(root, 'design', 'system', 'tokens.json'), 'utf8')
    expect(parseDesignTokens(tokens)?.meta.version).toBe(2)
    expect(await readFile(join(root, 'design', 'system', 'components.html'), 'utf8')).toBe(
      '<p>two</p>'
    )
  })

  it('refuses to restore when the project has no system', async () => {
    expect(await restore(1)).toEqual({ ok: false, error: 'not_found' })
  })

  it('logs a failed write by name only, without a host path', async () => {
    await writeSystem({ 'tokens.json': tokensAt(1) })
    await list()
    await writeSystem({ 'tokens.json': tokensAt(2) })
    await list()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await rm(join(root, 'design'), { recursive: true, force: true })
      await writeFile(join(root, 'design'), 'a file where the folder should be')
      expect(await restore(1)).toEqual({ ok: false, error: 'unwritable' })
      for (const call of warn.mock.calls) {
        expect(String(call[0])).not.toContain(root)
      }
    } finally {
      warn.mockRestore()
    }
  })
})
