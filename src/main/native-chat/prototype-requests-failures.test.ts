import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import type * as FsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import { directionNotesFor } from './prototype-direction-notes'
import type * as DirectionNotes from './prototype-direction-notes'
import { createPrototypeRequest, listPrototypeSets } from './prototype-requests'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  return { ...actual, writeFile: vi.fn(actual.writeFile) }
})

vi.mock('./prototype-direction-notes', async (importOriginal) => {
  const actual = await importOriginal<typeof DirectionNotes>()
  return { ...actual, directionNotesFor: vi.fn(actual.directionNotesFor) }
})

const SESSION = 'session-test-0001'
const NOW = new Date('2026-10-28T20:15:00.000Z')
const LATER = new Date('2026-10-28T20:16:00.000Z')
const FIXED_RANDOM = (): number => 0
/** The id the fixed clock and random source make for NOW. */
const REQUEST_ID = '20261028-201500-aaaaaa'

let stateDirectory: string

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-failures-'))
})

afterEach(async () => {
  vi.clearAllMocks()
  await rm(stateDirectory, { recursive: true, force: true })
})

function createAt(now: Date) {
  return createPrototypeRequest({
    stateDirectory,
    sessionId: SESSION,
    launchDirectory: undefined,
    request: { agent: 'claude', originalPrompt: 'a dashboard', count: 2 },
    now,
    random: FIXED_RANDOM
  })
}

function requestsFolder(): string {
  return join(nativeChatVisualsFolderFor(stateDirectory, SESSION), 'prototypes')
}

describe('createPrototypeRequest when the host cannot write the folder', () => {
  it('answers unwritable and removes the folder it made when the manifest cannot be written', async () => {
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('disk full'))

    expect(await createAt(NOW)).toEqual({ ok: false, error: 'unwritable' })
    expect(await readdir(requestsFolder())).toEqual([])
  })

  it('never removes a request folder that already existed', async () => {
    const folder = join(requestsFolder(), REQUEST_ID)
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'request.json'), '{"kept":true}')

    expect(await createAt(NOW)).toEqual({ ok: false, error: 'unwritable' })
    expect(await readFile(join(folder, 'request.json'), 'utf8')).toBe('{"kept":true}')
  })

  it('answers unwritable when the chat folder is a file and no request folder can be made', async () => {
    await mkdir(join(stateDirectory, 'native-chat-visuals'), { recursive: true })
    await writeFile(nativeChatVisualsFolderFor(stateDirectory, SESSION), 'not a folder')

    expect(await createAt(NOW)).toEqual({ ok: false, error: 'unwritable' })
  })
})

describe('listPrototypeSets when one request fails to read', () => {
  it('lists the other requests and leaves out only the one that failed', async () => {
    const older = await createAt(NOW)
    const newer = await createAt(LATER)
    if (!older.ok || !newer.ok) {
      throw new Error('expected both requests to be created')
    }
    await writeFile(join(older.folderPath, 'A.html'), '<p>older</p>')
    await writeFile(join(newer.folderPath, 'A.html'), '<p>newer</p>')
    // Why: the newest request is read first, so its read is the one that fails.
    vi.mocked(directionNotesFor).mockRejectedValueOnce(new Error('unreadable notes'))

    const listed = await listPrototypeSets({ stateDirectory })

    expect(listed.sets.map((set) => set.requestId)).toEqual([older.requestId])
  })
})
