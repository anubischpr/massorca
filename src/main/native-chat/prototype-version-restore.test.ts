import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import { restorePrototypeVersion } from './prototype-version-restore'

const SESSION = 'session-test-0001'
const REQUEST = '20261104-101500-aaaaaa'

let stateDirectory: string

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-restore-'))
})

afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
})

function folder(): string {
  return join(nativeChatVisualsFolderFor(stateDirectory, SESSION), 'prototypes', REQUEST)
}

async function writeSet(files: Record<string, string>): Promise<void> {
  await mkdir(folder(), { recursive: true })
  await writeFile(
    join(folder(), 'request.json'),
    JSON.stringify({
      version: 1,
      requestId: REQUEST,
      agent: 'claude',
      sessionId: SESSION,
      originalPrompt: 'a report page',
      count: 2,
      createdAt: '2026-11-04T10:15:00.000Z'
    })
  )
  for (const [name, html] of Object.entries(files)) {
    await writeFile(join(folder(), name), html)
  }
}

const everyone = (): boolean => true

function restore(letter: string, version: number, canAct = everyone) {
  return restorePrototypeVersion({
    stateDirectory,
    sessionId: SESSION,
    requestId: REQUEST,
    letter,
    version,
    canAct
  })
}

describe('restorePrototypeVersion', () => {
  it('copies an earlier version into the next version and keeps every version', async () => {
    await writeSet({ 'B.html': 'one', 'B-v2.html': 'two', 'B-v3.html': 'three', 'A.html': 'a' })
    expect(await restore('B', 2)).toEqual({
      ok: true,
      fileName: `prototypes/${REQUEST}/B-v4.html`,
      version: 4
    })
    expect(await readFile(join(folder(), 'B-v4.html'), 'utf8')).toBe('two')
    expect((await readdir(folder())).toSorted()).toEqual([
      'A.html',
      'B-v2.html',
      'B-v3.html',
      'B-v4.html',
      'B.html',
      'request.json'
    ])
    expect(await readFile(join(folder(), 'B-v3.html'), 'utf8')).toBe('three')
  })

  it('restores version 1, whose file has no version suffix', async () => {
    await writeSet({ 'A.html': 'first', 'A-v2.html': 'second' })
    expect(await restore('A', 1)).toMatchObject({ ok: true, version: 3 })
    expect(await readFile(join(folder(), 'A-v3.html'), 'utf8')).toBe('first')
  })

  it('refuses the latest version, a missing version and a missing direction', async () => {
    await writeSet({ 'B.html': 'one', 'B-v2.html': 'two' })
    expect(await restore('B', 2)).toEqual({ ok: false, error: 'not_found' })
    expect(await restore('B', 5)).toEqual({ ok: false, error: 'not_found' })
    expect(await restore('C', 1)).toEqual({ ok: false, error: 'not_found' })
    expect((await readdir(folder())).toSorted()).toEqual(['B-v2.html', 'B.html', 'request.json'])
  })

  it('refuses a caller that may not change the set, and writes nothing', async () => {
    await writeSet({ 'B.html': 'one', 'B-v2.html': 'two' })
    expect(await restore('B', 1, () => false)).toEqual({ ok: false, error: 'not_found' })
    expect(await readdir(folder())).not.toContain('B-v3.html')
  })

  it('refuses a request that does not exist', async () => {
    expect(await restore('B', 1)).toEqual({ ok: false, error: 'not_found' })
  })
})
