import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listBotTeamVersions, takeBotTeamSnapshot } from './bot-team-snapshots'
import type { BotTeamSnapshotDeps } from './bot-team-snapshot-types'
import {
  botTeamFileVersions,
  botTeamLastVersionOfFile,
  botTeamVersionChanges,
  readBotTeamVersionFile
} from './bot-team-version-read'
import { restoreBotTeamFile, restoreBotTeamVersion } from './bot-team-version-restore'

const SAVE = { reason: 'task-finished', label: 'Flyer done' } as const
const MB = 1024 * 1024

describe('versions of a team folder', () => {
  let root: string
  let folder: string
  let deps: BotTeamSnapshotDeps
  let clock: number

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'bot-team-versions-'))
    folder = path.join(root, 'team')
    await mkdir(folder)
    clock = 1_700_000_000_000
    deps = {
      folder,
      storeDir: path.join(root, 'bot-team-versions', 'team'),
      now: () => (clock += 60_000)
    }
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const write = async (name: string, text: string | Buffer): Promise<void> => {
    await mkdir(path.dirname(path.join(folder, name)), { recursive: true })
    await writeFile(path.join(folder, name), text)
  }
  const read = (name: string): Promise<string> => readFile(path.join(folder, name), 'utf8')
  const exists = (name: string): Promise<boolean> =>
    stat(path.join(folder, name)).then(
      () => true,
      () => false
    )
  const save = async (label: string = SAVE.label) => {
    const result = await takeBotTeamSnapshot(deps, { reason: SAVE.reason, label })
    if (!result.ok) {
      throw new Error(result.message)
    }
    return result
  }
  const objectPath = (hash: string): string =>
    path.join(deps.storeDir, 'objects', hash.slice(0, 2), hash)
  const manifestOf = async (id: string): Promise<{ files: Record<string, { hash: string }> }> =>
    JSON.parse(await readFile(path.join(deps.storeDir, 'versions', `${id}.json`), 'utf8'))

  async function listFiles(directory: string): Promise<string[]> {
    const out: string[] = []
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        out.push(...(await listFiles(full)))
      } else {
        out.push(full)
      }
    }
    return out.sort()
  }

  async function contentsOf(directory: string): Promise<Record<string, string>> {
    const contents: Record<string, string> = {}
    for (const file of await listFiles(directory)) {
      contents[path.relative(directory, file)] = (await readFile(file)).toString('base64')
    }
    return contents
  }

  const objectFiles = (): Promise<string[]> => listFiles(path.join(deps.storeDir, 'objects'))

  it('saves a folder and creates nothing inside it', async () => {
    await write('flyer.html', '<p>Summer</p>')
    await write('brand/notes.md', 'Colors')
    const before = await contentsOf(folder)

    const result = await save()

    expect(result.unchanged).toBe(false)
    expect(result.version).toMatchObject({
      id: '000001',
      label: 'Flyer done',
      reason: 'task-finished',
      skipped: 0
    })
    expect(await contentsOf(folder)).toEqual(before)
    expect(await exists('.git')).toBe(false)
    expect(await listBotTeamVersions(deps)).toHaveLength(1)
  })

  it('leaves a Git repository the person owns untouched and saves none of its files', async () => {
    await write('.git/HEAD', 'ref: refs/heads/main\n')
    await write('.git/index', Buffer.from([1, 2, 3, 4, 5]))
    await write('tracked.txt', 'three')
    await write('nested/.git/HEAD', 'ref: refs/heads/dev\n')
    await write('nested/inside.txt', 'nested')
    const before = await contentsOf(path.join(folder, '.git'))

    const result = await save()

    expect(await contentsOf(path.join(folder, '.git'))).toEqual(before)
    expect(await readBotTeamVersionFile(deps, result.version!.id, 'tracked.txt')).toEqual({
      kind: 'text',
      text: 'three'
    })
    expect(await readBotTeamVersionFile(deps, result.version!.id, '.git/HEAD')).toEqual({
      kind: 'missing'
    })
    expect(await readBotTeamVersionFile(deps, result.version!.id, 'nested/inside.txt')).toEqual({
      kind: 'missing'
    })
  })

  it('names the bot whose task finished, and no one for the person’s own restore', async () => {
    await write('a.txt', 'a')
    const finished = await takeBotTeamSnapshot(deps, { ...SAVE, author: 'Iris' })
    expect(finished.ok && finished.version?.author).toBe('Iris')
    await write('a.txt', 'b')
    const restored = await restoreBotTeamVersion(deps, '000001')
    expect(restored.ok).toBe(true)
    const versions = (await listBotTeamVersions(deps)).map((v) => [v.reason, v.author])
    expect(versions).toEqual([
      ['restored', null],
      ['before-restore', null],
      ['task-finished', 'Iris']
    ])
  })

  it('records nothing when nothing changed, and an empty folder has no version', async () => {
    expect(await save()).toMatchObject({ unchanged: true, version: null })
    await write('a.txt', 'a')
    const first = await save()
    const again = await save()
    expect(again.unchanged).toBe(true)
    expect(again.version?.id).toBe(first.version?.id)
    expect(await listBotTeamVersions(deps)).toHaveLength(1)
  })

  it('skips files over the size limit and says how many', async () => {
    deps.limits = { maxFileBytes: 10, maxFiles: 100, maxNewBytes: 1000 }
    await write('small.txt', 'tiny')
    await write('big.bin', Buffer.alloc(11, 1))
    const result = await save()
    expect(result.version?.skipped).toBe(1)
    expect(await botTeamVersionChanges(deps, result.version!.id)).toEqual([
      { status: 'added', path: 'small.txt' }
    ])
  })

  it('refuses a version over the new-bytes or file-count limit, and writes no object', async () => {
    deps.limits = { maxFileBytes: 10, maxFiles: 100, maxNewBytes: 12 }
    await write('a.txt', '123456789')
    await write('b.txt', 'abcdefghi')
    expect(await takeBotTeamSnapshot(deps, SAVE)).toMatchObject({
      ok: false,
      reason: 'too-large'
    })
    expect(await listBotTeamVersions(deps)).toEqual([])
    expect(await objectFiles()).toEqual([])

    deps.limits = { maxFileBytes: 10, maxFiles: 1, maxNewBytes: 1000 }
    expect(await takeBotTeamSnapshot(deps, SAVE)).toMatchObject({ ok: false, reason: 'too-large' })
    expect(await objectFiles()).toEqual([])
  })

  it('does not save what the folder ignores', async () => {
    await write('.gitignore', 'secret.txt\nnode_modules/\n*.log\n')
    await write('secret.txt', 'key')
    await write('node_modules/pkg/index.js', 'x')
    await write('debug/run.log', 'log')
    await write('kept.txt', 'kept')
    const result = await save()
    const changes = await botTeamVersionChanges(deps, result.version!.id)
    expect(changes.map((change) => change.path).sort()).toEqual(['.gitignore', 'kept.txt'])
  })

  it('keeps names with spaces and accents', async () => {
    await write('Lista de precios ñandú.txt', 'precio')
    const result = await save()
    expect(
      await readBotTeamVersionFile(deps, result.version!.id, 'Lista de precios ñandú.txt')
    ).toEqual({ kind: 'text', text: 'precio' })
  })

  it('reports a store that cannot be written as failed', async () => {
    await write('a.txt', 'a')
    await writeFile(path.join(root, 'blocked'), 'a file, not a folder')
    const result = await takeBotTeamSnapshot(
      { ...deps, storeDir: path.join(root, 'blocked', 'team') },
      SAVE
    )
    expect(result).toMatchObject({ ok: false, reason: 'failed' })
  })

  it('lists changes per version, the versions of one file, and reads either side', async () => {
    await write('flyer.html', 'v1')
    await write('logo.png', Buffer.from([0, 1, 2, 3]))
    const first = await save('First layout')
    await write('flyer.html', 'v2')
    const second = await save('Text only')
    await write('price.txt', 'p')
    await rm(path.join(folder, 'flyer.html'))
    const third = await save('Price list')

    expect(await botTeamVersionChanges(deps, first.version!.id)).toEqual([
      { status: 'added', path: 'flyer.html' },
      { status: 'added', path: 'logo.png' }
    ])
    expect(await botTeamVersionChanges(deps, third.version!.id)).toEqual([
      { status: 'deleted', path: 'flyer.html' },
      { status: 'added', path: 'price.txt' }
    ])
    const flyer = await botTeamFileVersions(deps, 'flyer.html')
    expect(flyer.map((entry) => [entry.version.label, entry.deleted])).toEqual([
      ['Price list', true],
      ['Text only', false],
      ['First layout', false]
    ])
    expect(await botTeamLastVersionOfFile(deps)).toMatchObject({
      'flyer.html': third.version!.id,
      'logo.png': first.version!.id,
      'price.txt': third.version!.id
    })
    expect(await readBotTeamVersionFile(deps, first.version!.id, 'flyer.html')).toEqual({
      kind: 'text',
      text: 'v1'
    })
    expect(await readBotTeamVersionFile(deps, second.version!.id, 'flyer.html')).toEqual({
      kind: 'text',
      text: 'v2'
    })
    expect(await readBotTeamVersionFile(deps, first.version!.id, 'logo.png')).toEqual({
      kind: 'binary',
      size: 4
    })
    expect(await readBotTeamVersionFile(deps, third.version!.id, 'flyer.html')).toEqual({
      kind: 'missing'
    })
    const listed = await listBotTeamVersions(deps)
    expect(listed.map((version) => version.id)).toEqual(['000003', '000002', '000001'])
    expect(listed[0].createdAt).toBeGreaterThan(listed[1].createdAt)
  })

  it('stores an unchanged large binary file once across versions', async () => {
    const clip = Buffer.alloc(6 * MB, 7)
    clip[0] = 0
    await write('clip.mov', clip)
    await write('note.txt', 'one')
    await save('First')
    await write('note.txt', 'two')
    const second = await save('Second')

    const objects = await objectFiles()
    expect(objects).toHaveLength(3)
    const sizes = await Promise.all(objects.map(async (file) => (await stat(file)).size))
    expect(sizes.filter((size) => size === 6 * MB)).toHaveLength(1)
    expect(await readBotTeamVersionFile(deps, second.version!.id, 'clip.mov')).toEqual({
      kind: 'binary',
      size: 6 * MB
    })
  })

  it('reads a text version over the preview size as too large, and a binary one as binary', async () => {
    await write('long.txt', 'a'.repeat(MB + 1))
    await write('data.bin', Buffer.from([0, 1, 2]))
    const saved = await save()
    expect(await readBotTeamVersionFile(deps, saved.version!.id, 'long.txt')).toEqual({
      kind: 'too-large',
      size: MB + 1
    })
    expect(await readBotTeamVersionFile(deps, saved.version!.id, 'data.bin')).toEqual({
      kind: 'binary',
      size: 3
    })
  })

  it('names a version by the sha256 of its manifest in commit and tree', async () => {
    await write('a.txt', 'a')
    const saved = await save()
    const bytes = await readFile(path.join(deps.storeDir, 'versions', `${saved.version!.id}.json`))
    const digest = createHash('sha256').update(bytes).digest('hex')
    expect(saved.version).toMatchObject({ commit: digest, tree: digest })
  })

  it('keeps every object a saved version points at', async () => {
    await write('a.txt', 'one')
    await write('img.png', Buffer.from([0, 9, 9]))
    await save('First')
    await write('a.txt', 'two')
    await save('Second')
    await rm(path.join(folder, 'img.png'))
    await save('Third')

    const versions = await listBotTeamVersions(deps)
    expect(versions).toHaveLength(3)
    for (const version of versions) {
      for (const entry of Object.values((await manifestOf(version.id)).files)) {
        expect(
          await stat(objectPath(entry.hash)).then(
            () => true,
            () => false
          )
        ).toBe(true)
      }
    }
  })

  it('restores an earlier version after saving the current state, so nothing is lost', async () => {
    await write('flyer.html', 'v1')
    await write('brand/notes.md', 'old notes')
    const first = await save('First layout')
    await write('flyer.html', 'v2')
    await write('extra.txt', 'new file')
    await rm(path.join(folder, 'brand', 'notes.md'))
    await write('.gitignore', 'ignored.txt\n')
    await write('ignored.txt', 'not versioned')

    const restored = await restoreBotTeamVersion(deps, first.version!.id)

    expect(restored).toMatchObject({ ok: true })
    expect(await read('flyer.html')).toBe('v1')
    expect(await read('brand/notes.md')).toBe('old notes')
    expect(await exists('extra.txt')).toBe(false)
    expect(await read('ignored.txt')).toBe('not versioned')
    if (!restored.ok) {
      throw new Error('unreachable')
    }
    expect(restored.savedBefore?.reason).toBe('before-restore')

    // The state from before the restore is a version, and restoring it brings everything back.
    const back = await restoreBotTeamVersion(deps, restored.savedBefore!.id)
    expect(back.ok).toBe(true)
    expect(await read('flyer.html')).toBe('v2')
    expect(await read('extra.txt')).toBe('new file')
    expect(await exists('brand/notes.md')).toBe(false)
    const reasons = (await listBotTeamVersions(deps)).map((version) => version.reason)
    expect(reasons).toContain('restored')
  })

  it('restores one file after saving everything, and leaves the other files as they are', async () => {
    await write('flyer.html', 'v1')
    await write('price.txt', 'p1')
    const first = await save('First layout')
    await write('flyer.html', 'v2')
    await write('price.txt', 'p2')

    const restored = await restoreBotTeamFile(deps, first.version!.id, 'flyer.html')

    expect(restored).toMatchObject({ ok: true })
    expect(await read('flyer.html')).toBe('v1')
    expect(await read('price.txt')).toBe('p2')
    if (!restored.ok) {
      throw new Error('unreachable')
    }
    const before = restored.savedBefore!
    expect(before.reason).toBe('before-restore')
    expect(await readBotTeamVersionFile(deps, before.id, 'flyer.html')).toEqual({
      kind: 'text',
      text: 'v2'
    })
    // Going back to the state saved before the restore brings the newer text back.
    await restoreBotTeamFile(deps, before.id, 'flyer.html')
    expect(await read('flyer.html')).toBe('v2')
  })

  it('restores a binary file byte for byte', async () => {
    const original = Buffer.from([0, 255, 1, 128, 0, 42])
    await write('pack.bin', original)
    const first = await save('First')
    await write('pack.bin', Buffer.from([9, 9]))

    expect(await restoreBotTeamFile(deps, first.version!.id, 'pack.bin')).toMatchObject({
      ok: true
    })
    expect(await readFile(path.join(folder, 'pack.bin'))).toEqual(original)
  })

  it('refuses to restore a file a version never held, or a path outside the folder', async () => {
    await write('a.txt', 'a')
    const first = await save()
    expect(await restoreBotTeamFile(deps, first.version!.id, 'nope.txt')).toMatchObject({
      ok: false
    })
    expect(await restoreBotTeamFile(deps, first.version!.id, '../outside.txt')).toMatchObject({
      ok: false
    })
    expect(await restoreBotTeamFile(deps, first.version!.id, '.git/config')).toMatchObject({
      ok: false
    })
    expect(await listBotTeamVersions(deps)).toHaveLength(1)
  })

  it('does not add a version when the folder already is the restored version', async () => {
    await write('a.txt', 'a')
    const only = await save()
    const before = await listBotTeamVersions(deps)
    const restored = await restoreBotTeamVersion(deps, only.version!.id)
    expect(restored).toMatchObject({ ok: true, savedBefore: null })
    expect(await listBotTeamVersions(deps)).toEqual(before)
  })

  it('leaves a file that is over the size limit alone when restoring', async () => {
    deps.limits = { maxFileBytes: 10, maxFiles: 100, maxNewBytes: 1000 }
    await write('a.txt', 'one')
    const first = await save()
    await write('a.txt', 'two')
    await write('big.bin', Buffer.alloc(50, 7))
    await restoreBotTeamVersion(deps, first.version!.id)
    expect(await read('a.txt')).toBe('one')
    expect((await readFile(path.join(folder, 'big.bin'))).length).toBe(50)
  })

  it('refuses to restore a version that does not exist', async () => {
    expect(await restoreBotTeamVersion(deps, '000099')).toMatchObject({
      ok: false,
      reason: 'missing-version'
    })
  })

  it('numbers versions apart when two saves happen at once', async () => {
    await write('a.txt', 'a')
    const [one, two] = await Promise.all([save('One'), save('Two')])
    expect([one.unchanged, two.unchanged].sort()).toEqual([false, true])
    await write('a.txt', 'b')
    await Promise.all([save('Three'), save('Four')])
    expect((await listBotTeamVersions(deps)).map((version) => version.id)).toEqual([
      '000002',
      '000001'
    ])
  })
})
