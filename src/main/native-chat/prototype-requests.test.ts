import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NATIVE_CHAT_VISUAL_MAX_BYTES } from '../../shared/native-chat-visual-directive'
import { PROTOTYPE_ATTACHMENT_MAX_BYTES } from '../../shared/rpc-contract/prototype-params'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import {
  createPrototypeRequest,
  listPrototypeSets,
  readPrototypeSetFile,
  writePrototypeAttachment
} from './prototype-requests'

const SESSION = 'session-test-0001'
const NOW = new Date('2026-10-28T20:15:00.000Z')
const LATER = new Date('2026-10-28T20:16:00.000Z')
const FIXED_RANDOM = (): number => 0

let stateDirectory: string
let launchDirectory: string

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-state-'))
  launchDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-cwd-'))
})

afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(launchDirectory, { recursive: true, force: true })
})

function visualsFolder(): string {
  return nativeChatVisualsFolderFor(stateDirectory, SESSION)
}

async function create(
  agent: 'claude' | 'gentle-shell',
  now: Date,
  extra: { worktreeId?: string; chatTitle?: string } = {}
): Promise<{ requestId: string; folderPath: string }> {
  const result = await createPrototypeRequest({
    stateDirectory,
    sessionId: SESSION,
    launchDirectory,
    request: { agent, originalPrompt: 'a dashboard', count: 2, ...extra },
    now,
    random: FIXED_RANDOM
  })
  if (!result.ok) {
    throw new Error('expected a created request')
  }
  return { requestId: result.requestId, folderPath: result.folderPath }
}

async function writeIn(folder: string, name: string, content: string | Buffer): Promise<void> {
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, name), content)
}

/** A manifest written by hand, for shapes the create path would never produce. */
async function writeManifest(requestId: string, overrides: Record<string, unknown> = {}) {
  await writeIn(
    join(visualsFolder(), 'prototypes', requestId),
    'request.json',
    JSON.stringify({
      version: 1,
      requestId,
      agent: 'claude',
      sessionId: SESSION,
      originalPrompt: 'a dashboard',
      count: 2,
      createdAt: NOW.toISOString(),
      ...overrides
    })
  )
}

describe('createPrototypeRequest', () => {
  it('writes request.json in a new prototypes folder and returns its absolute path', async () => {
    const created = await create('claude', NOW, { worktreeId: 'wt-1', chatTitle: 'Dashboard' })

    expect(created.folderPath).toBe(join(visualsFolder(), 'prototypes', created.requestId))
    const manifest: unknown = JSON.parse(
      await readFile(join(created.folderPath, 'request.json'), 'utf8')
    )
    expect(manifest).toMatchObject({
      version: 1,
      requestId: created.requestId,
      agent: 'claude',
      sessionId: SESSION,
      originalPrompt: 'a dashboard',
      count: 2,
      worktreeId: 'wt-1',
      chatTitle: 'Dashboard',
      createdAt: NOW.toISOString()
    })
    expect(manifest).not.toHaveProperty('gentleDesignBaseline')
  })

  it('records the design folders that already hold a design.json for a Gentle Shell request', async () => {
    await writeIn(join(launchDirectory, 'design', 'old-one'), 'design.json', '{}')
    await mkdir(join(launchDirectory, 'design', 'no-json'), { recursive: true })
    const created = await create('gentle-shell', NOW)

    const manifest: unknown = JSON.parse(
      await readFile(join(created.folderPath, 'request.json'), 'utf8')
    )
    expect(manifest).toMatchObject({
      agent: 'gentle-shell',
      sessionCwd: launchDirectory,
      gentleDesignBaseline: ['old-one']
    })
  })

  it('omits the Gentle Shell baseline when the chat has no launch directory', async () => {
    const result = await createPrototypeRequest({
      stateDirectory,
      sessionId: SESSION,
      launchDirectory: undefined,
      request: { agent: 'gentle-shell', originalPrompt: 'x', count: 1 },
      now: NOW,
      random: FIXED_RANDOM
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const manifest: unknown = JSON.parse(
      await readFile(join(result.folderPath, 'request.json'), 'utf8')
    )
    expect(manifest).not.toHaveProperty('sessionCwd')
    expect(manifest).not.toHaveProperty('gentleDesignBaseline')
  })
})

describe('listPrototypeSets', () => {
  it('lists each request with its direction versions and their mtimes, newest first', async () => {
    const older = await create('claude', NOW)
    const newer = await create('claude', LATER, { worktreeId: 'wt-1' })
    await writeIn(older.folderPath, 'A.html', '<p>a</p>')
    await writeIn(newer.folderPath, 'A.html', '<p>a</p>')
    await writeIn(newer.folderPath, 'B.html', '<p>b</p>')
    await writeIn(newer.folderPath, 'B-v2.html', '<p>b2</p>')
    await writeIn(newer.folderPath, 'notes.txt', 'ignored')

    const listed = await listPrototypeSets({ stateDirectory })

    expect(listed.sets.map((set) => set.requestId)).toEqual([newer.requestId, older.requestId])
    const [first] = listed.sets
    expect(first).toMatchObject({
      requestId: newer.requestId,
      sessionId: SESSION,
      agent: 'claude',
      worktreeId: 'wt-1',
      chatTitle: null,
      originalPrompt: 'a dashboard',
      createdAt: LATER.toISOString(),
      count: 2
    })
    expect(first?.folderPath).toBe(newer.folderPath)
    expect(first?.directions.map((direction) => direction.letter)).toEqual(['A', 'B'])
    expect(first?.directions[1]?.versions.map((version) => version.fileName)).toEqual([
      `prototypes/${newer.requestId}/B.html`,
      `prototypes/${newer.requestId}/B-v2.html`
    ])
    expect(typeof first?.directions[0]?.versions[0]?.mtime).toBe('number')
  })

  it('skips a request that has no direction file', async () => {
    const empty = await create('claude', NOW)
    await writeIn(empty.folderPath, 'readme.txt', 'nothing yet')

    expect((await listPrototypeSets({ stateDirectory })).sets).toEqual([])
  })

  it('still lists a chat when another chat holds more request folders than the scan bound', async () => {
    const busyPrototypes = join(
      nativeChatVisualsFolderFor(stateDirectory, 'session-busy-0002'),
      'prototypes'
    )
    await Promise.all(
      Array.from({ length: 600 }, (_, index) =>
        mkdir(join(busyPrototypes, `29991231-235959-${String(index).padStart(6, '0')}`), {
          recursive: true
        })
      )
    )
    const quiet = await create('claude', NOW)
    await writeIn(quiet.folderPath, 'A.html', '<p>a</p>')

    const listed = await listPrototypeSets({ stateDirectory })

    expect(listed.sets.map((set) => set.requestId)).toEqual([quiet.requestId])
  })

  it('keeps only the requests of one worktree when asked', async () => {
    const mine = await create('claude', NOW, { worktreeId: 'wt-1' })
    const other = await create('claude', LATER, { worktreeId: 'wt-2' })
    await writeIn(mine.folderPath, 'A.html', '<p>a</p>')
    await writeIn(other.folderPath, 'A.html', '<p>a</p>')

    const listed = await listPrototypeSets({ stateDirectory, worktreeId: 'wt-1' })

    expect(listed.sets.map((set) => set.requestId)).toEqual([mine.requestId])
  })

  it('ignores a manifest filed under another session or larger than the manifest bound', async () => {
    await writeManifest('20261028-201500-misfil', { sessionId: 'session-other-0002' })
    await writeIn(join(visualsFolder(), 'prototypes', '20261028-201500-misfil'), 'A.html', 'x')
    await writeManifest('20261028-201500-bigone', {
      originalPrompt: 'x'.repeat(300 * 1024)
    })
    await writeIn(join(visualsFolder(), 'prototypes', '20261028-201500-bigone'), 'A.html', 'x')

    expect((await listPrototypeSets({ stateDirectory })).sets).toEqual([])
  })

  it('binds the one new Gentle Shell design folder, and its artboards only', async () => {
    const created = await create('gentle-shell', NOW)
    await writeIn(
      join(launchDirectory, 'design', 'bold'),
      'design.json',
      JSON.stringify({
        title: 'Bold',
        brief: 'brief',
        artboards: [
          { file: 'home.html', title: 'Home' },
          { file: 'checkout.html', title: 'Checkout' }
        ]
      })
    )
    await writeIn(join(launchDirectory, 'design', 'bold'), 'home.html', '<p>home</p>')

    const listed = await listPrototypeSets({ stateDirectory })

    expect(listed.sets).toHaveLength(1)
    expect(listed.sets[0]?.requestId).toBe(created.requestId)
    expect(listed.sets[0]?.directions).toMatchObject([
      { letter: 'A', versions: [{ version: 1, fileName: 'design/bold/home.html' }] }
    ])
  })

  it('binds no Gentle Shell folder when two appeared since the send', async () => {
    await create('gentle-shell', NOW)
    for (const slug of ['first', 'second']) {
      await writeIn(
        join(launchDirectory, 'design', slug),
        'design.json',
        JSON.stringify({
          title: slug,
          brief: 'brief',
          artboards: [{ file: 'index.html', title: 'Index' }]
        })
      )
      await writeIn(join(launchDirectory, 'design', slug), 'index.html', '<p>x</p>')
    }

    expect((await listPrototypeSets({ stateDirectory })).sets).toEqual([])
  })
})

describe('readPrototypeSetFile', () => {
  it('returns the HTML of a direction file of its own request', async () => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'A.html', '<p>a</p>')

    expect(
      await readPrototypeSetFile({
        stateDirectory,
        sessionId: SESSION,
        requestId: created.requestId,
        fileName: `prototypes/${created.requestId}/A.html`
      })
    ).toEqual({ ok: true, html: '<p>a</p>' })
  })

  it('answers not_found for a missing file, a non-set name, a traversal and an unknown request', async () => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'notes.txt', 'not a set file')
    const base = { stateDirectory, sessionId: SESSION, requestId: created.requestId }

    for (const fileName of [
      `prototypes/${created.requestId}/B.html`,
      `prototypes/${created.requestId}/notes.txt`,
      `prototypes/${created.requestId}/../${created.requestId}/request.json`,
      `prototypes/${created.requestId}/B-v1.html`
    ]) {
      expect(await readPrototypeSetFile({ ...base, fileName })).toEqual({
        ok: false,
        error: 'not_found'
      })
    }
    expect(
      await readPrototypeSetFile({
        ...base,
        requestId: '20250101-000000-zzzzzz',
        fileName: 'A.html'
      })
    ).toEqual({ ok: false, error: 'not_found' })
  })

  it('answers too_large for a file over the visual byte cap', async () => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'A.html', Buffer.alloc(NATIVE_CHAT_VISUAL_MAX_BYTES + 1, 'x'))

    expect(
      await readPrototypeSetFile({
        stateDirectory,
        sessionId: SESSION,
        requestId: created.requestId,
        fileName: `prototypes/${created.requestId}/A.html`
      })
    ).toEqual({ ok: false, error: 'too_large' })
  })

  it('serves a Gentle Shell artboard of the bound design folder only', async () => {
    const created = await create('gentle-shell', NOW)
    await writeIn(
      join(launchDirectory, 'design', 'bold'),
      'design.json',
      JSON.stringify({
        title: 'Bold',
        brief: 'brief',
        artboards: [{ file: 'home.html', title: 'Home' }]
      })
    )
    await writeIn(join(launchDirectory, 'design', 'bold'), 'home.html', '<p>home</p>')
    await writeIn(join(launchDirectory, 'design', 'bold'), 'secret.html', '<p>not an artboard</p>')
    const base = { stateDirectory, sessionId: SESSION, requestId: created.requestId }

    expect(await readPrototypeSetFile({ ...base, fileName: 'design/bold/home.html' })).toEqual({
      ok: true,
      html: '<p>home</p>'
    })
    expect(await readPrototypeSetFile({ ...base, fileName: 'design/bold/secret.html' })).toEqual({
      ok: false,
      error: 'not_found'
    })
  })
})

describe('the directions.json the agent writes', () => {
  it('gives each direction the name and tradeoff the agent wrote for its letter', async () => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'A.html', '<p>a</p>')
    await writeIn(created.folderPath, 'B.html', '<p>b</p>')
    await writeIn(
      created.folderPath,
      'directions.json',
      JSON.stringify([
        { letter: 'A', name: 'Quiet grid', tradeoff: 'Calm, but dense.' },
        { letter: 'B', name: 'Bold cards', tradeoff: 'Loud, but quick to scan.' },
        { letter: 'C', name: 'Not in the set', tradeoff: 'No C file exists.' }
      ])
    )

    const listed = await listPrototypeSets({ stateDirectory })
    expect(listed.sets[0]?.directions).toMatchObject([
      { letter: 'A', name: 'Quiet grid', tradeoff: 'Calm, but dense.' },
      { letter: 'B', name: 'Bold cards', tradeoff: 'Loud, but quick to scan.' }
    ])
  })

  it.each([
    ['malformed JSON', '[{"letter":"A","name":'],
    ['an empty name', JSON.stringify([{ letter: 'A', name: '', tradeoff: 'Calm.' }])],
    ['a non-array', JSON.stringify({ A: 'Quiet grid' })]
  ])('lists the set without names when it holds %s', async (_label, content) => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'A.html', '<p>a</p>')
    await writeIn(created.folderPath, 'directions.json', content)

    const listed = await listPrototypeSets({ stateDirectory })
    expect(listed.sets.map((set) => set.requestId)).toEqual([created.requestId])
    expect(listed.sets[0]?.directions[0]).toMatchObject({ letter: 'A' })
    expect(listed.sets[0]?.directions[0]).not.toHaveProperty('name')
    expect(listed.sets[0]?.directions[0]).not.toHaveProperty('tradeoff')
  })

  it('ignores a directions.json over its size bound, even when its JSON is valid', async () => {
    const created = await create('claude', NOW)
    await writeIn(created.folderPath, 'A.html', '<p>a</p>')
    const valid = JSON.stringify([{ letter: 'A', name: 'Quiet grid', tradeoff: 'Calm.' }])
    await writeIn(created.folderPath, 'directions.json', valid + ' '.repeat(16 * 1024))

    const listed = await listPrototypeSets({ stateDirectory })
    expect(listed.sets.map((set) => set.requestId)).toEqual([created.requestId])
    expect(listed.sets[0]?.directions[0]).not.toHaveProperty('name')
  })
})

describe('writePrototypeAttachment', () => {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const png = (body: string): Buffer => Buffer.concat([PNG_SIGNATURE, Buffer.from(body)])

  function attach(requestId: string, pngBase64: string, name = 'note-1') {
    return writePrototypeAttachment({
      stateDirectory,
      sessionId: SESSION,
      requestId,
      name,
      pngBase64
    })
  }

  it('writes a PNG under the request notes folder and returns its path', async () => {
    const created = await create('claude', NOW)

    expect(await attach(created.requestId, png('first').toString('base64'))).toEqual({
      ok: true,
      path: join(created.folderPath, 'notes', 'note-1.png')
    })
    expect(await readFile(join(created.folderPath, 'notes', 'note-1.png'))).toEqual(png('first'))
  })

  it('overwrites the same name on a retry', async () => {
    const created = await create('claude', NOW)
    await attach(created.requestId, png('first').toString('base64'))
    await attach(created.requestId, png('second').toString('base64'))

    expect(await readFile(join(created.folderPath, 'notes', 'note-1.png'))).toEqual(png('second'))
  })

  it.each([
    ['text that is not base64', 'not base64 !!'],
    ['base64 without its padding', png('ab').toString('base64').replace(/=+$/u, '')],
    ['bytes that are not a PNG', Buffer.from('hello world').toString('base64')],
    ['an empty string', '']
  ])('refuses %s as invalid', async (_label, pngBase64) => {
    const created = await create('claude', NOW)

    expect(await attach(created.requestId, pngBase64)).toEqual({ ok: false, error: 'invalid' })
  })

  it('refuses a name that is not one plain file name', async () => {
    const created = await create('claude', NOW)
    const pngBase64 = png('x').toString('base64')

    for (const name of ['../escape', 'nested/name', '.hidden', '']) {
      expect(await attach(created.requestId, pngBase64, name)).toEqual({
        ok: false,
        error: 'invalid'
      })
    }
  })

  it('answers too_large above the byte cap and keeps a PNG of exactly the cap', async () => {
    const created = await create('claude', NOW)
    const body = PROTOTYPE_ATTACHMENT_MAX_BYTES - PNG_SIGNATURE.length

    expect(
      await attach(
        created.requestId,
        Buffer.concat([PNG_SIGNATURE, Buffer.alloc(body + 1)]).toString('base64')
      )
    ).toEqual({ ok: false, error: 'too_large' })
    expect(
      await attach(
        created.requestId,
        Buffer.concat([PNG_SIGNATURE, Buffer.alloc(body)]).toString('base64')
      )
    ).toEqual({ ok: true, path: join(created.folderPath, 'notes', 'note-1.png') })
  })

  it('answers unsupported for a request this chat has no folder for', async () => {
    expect(await attach('20261028-201500-zzzzzz', png('x').toString('base64'))).toEqual({
      ok: false,
      error: 'unsupported'
    })
  })
})
