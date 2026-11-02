import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeamSnapshotGit } from './bot-team-snapshot-git'
import { listBotTeamVersions, takeBotTeamSnapshot } from './bot-team-snapshots'
import type { BotTeamSnapshotDeps } from './bot-team-snapshot-types'
import {
  botTeamFileVersions,
  botTeamLastVersionOfFile,
  botTeamVersionChanges,
  readBotTeamVersionFile
} from './bot-team-version-read'
import { restoreBotTeamFile, restoreBotTeamVersion } from './bot-team-version-restore'

// Every case runs real Git many times, which is slow on a busy Windows machine.
vi.setConfig({ testTimeout: 120_000 })

const SAVE = { reason: 'task-finished', label: 'Flyer done' } as const

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
      gitDir: path.join(root, 'private', 'team.git'),
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

  async function listTree(directory: string): Promise<string[]> {
    const out: string[] = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      out.push(path.relative(folder, full))
      if (entry.isDirectory()) {
        out.push(...(await listTree(full)))
      }
    }
    return out.sort()
  }

  it('saves a folder that has no Git and creates nothing inside it', async () => {
    await write('flyer.html', '<p>Summer</p>')
    await write('brand/notes.md', 'Colors')
    const before = await listTree(folder)

    const result = await save()

    expect(result.unchanged).toBe(false)
    expect(result.version).toMatchObject({
      id: '000001',
      label: 'Flyer done',
      reason: 'task-finished',
      skipped: 0
    })
    expect(await listTree(folder)).toEqual(before)
    expect(await exists('.git')).toBe(false)
    expect(await listBotTeamVersions(deps)).toHaveLength(1)
  })

  it('leaves the branches, index and files of a repository the person owns untouched', async () => {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: folder, encoding: 'utf8' }).trim()
    git('init', '-q')
    git('config', 'user.email', 'me@example.com')
    git('config', 'user.name', 'Me')
    await write('tracked.txt', 'one')
    git('add', 'tracked.txt')
    git('commit', '-q', '-m', 'first')
    await write('tracked.txt', 'two')
    await write('new.txt', 'untracked')
    git('add', 'tracked.txt')
    await write('tracked.txt', 'three')

    const index = async () =>
      createHash('sha1')
        .update(await readFile(path.join(folder, '.git', 'index')))
        .digest('hex')
    const snapshotOfRepository = async () => ({
      status: git('status', '--porcelain'),
      refs: git('for-each-ref'),
      head: git('rev-parse', 'HEAD'),
      branches: git('branch', '--list'),
      index: await index(),
      dotGit: (await listTree(path.join(folder, '.git'))).filter(
        (entry) => !entry.includes(`objects${path.sep}`) || entry.endsWith('pack')
      ),
      files: await readdir(folder)
    })
    const before = await snapshotOfRepository()

    const result = await save()

    expect(result.version).not.toBeNull()
    expect(await snapshotOfRepository()).toEqual(before)
    const saved = await readBotTeamVersionFile(deps, result.version!.id, 'tracked.txt')
    expect(saved).toEqual({ kind: 'text', text: 'three' })
    // The person's own files are saved, not their repository.
    expect(await readBotTeamVersionFile(deps, result.version!.id, '.git/HEAD')).toEqual({
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
    deps.limits = { maxFileBytes: 10, maxTotalBytes: 1000, maxFiles: 100 }
    await write('small.txt', 'tiny')
    await write('big.bin', Buffer.alloc(11, 1))
    const result = await save()
    expect(result.version?.skipped).toBe(1)
    expect(await botTeamVersionChanges(deps, result.version!.id)).toEqual([
      { status: 'added', path: 'small.txt' }
    ])
  })

  it('refuses a folder over the total limit and stores no version', async () => {
    deps.limits = { maxFileBytes: 10, maxTotalBytes: 12, maxFiles: 100 }
    await write('a.txt', '123456789')
    await write('b.txt', '123456789')
    const result = await takeBotTeamSnapshot(deps, SAVE)
    expect(result).toMatchObject({ ok: false, reason: 'too-large' })
    expect(await listBotTeamVersions(deps)).toEqual([])

    deps.limits = { maxFileBytes: 10, maxTotalBytes: 1000, maxFiles: 1 }
    expect(await takeBotTeamSnapshot(deps, SAVE)).toMatchObject({ ok: false, reason: 'too-large' })
  })

  it('does not save what the folder ignores', async () => {
    await write('.gitignore', 'secret.txt\nnode_modules/\n')
    await write('secret.txt', 'key')
    await write('node_modules/pkg/index.js', 'x')
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

  it('reports a missing Git as unavailable', async () => {
    const missing = Object.assign(new Error('spawn git ENOENT'), {
      code: 'ENOENT',
      syscall: 'spawn git'
    })
    const git: BotTeamSnapshotGit = {
      text: () => Promise.reject(missing),
      bytes: () => Promise.reject(missing)
    }
    expect(await takeBotTeamSnapshot({ ...deps, git }, SAVE)).toMatchObject({
      ok: false,
      reason: 'git-unavailable'
    })
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
      kind: 'binary'
    })
    expect(await readBotTeamVersionFile(deps, third.version!.id, 'flyer.html')).toEqual({
      kind: 'missing'
    })
    const listed = await listBotTeamVersions(deps)
    expect(listed.map((version) => version.id)).toEqual(['000003', '000002', '000001'])
    expect(listed[0].createdAt).toBeGreaterThan(listed[1].createdAt)
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
    deps.limits = { maxFileBytes: 10, maxTotalBytes: 1000, maxFiles: 100 }
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
