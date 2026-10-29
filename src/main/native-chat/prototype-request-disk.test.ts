import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  parsePrototypeRequestManifest,
  type PrototypeRequestManifest
} from '../../shared/prototype-sets'
import { gentleDesignSetFor, recordRequestDesignSystemVersion } from './prototype-request-disk'

const REQUEST_ID = '20261028-201500-k3f9q2'
let root: string
let launchDirectory: string
let requestFolder: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-prototypes-disk-'))
  launchDirectory = join(root, 'chat')
  requestFolder = join(root, 'visuals', 'prototypes', REQUEST_ID)
  await mkdir(requestFolder, { recursive: true })
  await writeDesign('bold')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function writeDesign(slug: string): Promise<void> {
  const folder = join(launchDirectory, 'design', slug)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'design.json'),
    JSON.stringify({
      title: slug,
      brief: 'brief',
      artboards: [{ file: 'home.html', title: 'Home' }]
    })
  )
  await writeFile(join(folder, 'home.html'), '<p>home</p>')
}

function manifestWith(overrides: Record<string, unknown> = {}): PrototypeRequestManifest {
  const manifest = parsePrototypeRequestManifest({
    version: 1,
    requestId: REQUEST_ID,
    agent: 'gentle-shell',
    sessionId: 'session-1',
    originalPrompt: '/prototype pricing page',
    count: 2,
    createdAt: '2026-10-28T20:15:00.000Z',
    sessionCwd: launchDirectory,
    gentleDesignBaseline: [],
    ...overrides
  })
  if (manifest === null) {
    throw new Error('the fixture manifest does not parse')
  }
  return manifest
}

describe('gentleDesignSetFor', () => {
  it('binds the new design folder into request.json and reads its artboards', async () => {
    await writeFile(join(requestFolder, 'request.json'), JSON.stringify(manifestWith()))
    const set = await gentleDesignSetFor(requestFolder, manifestWith(), launchDirectory)

    expect(set?.directions).toEqual([
      { letter: 'A', versions: [{ version: 1, fileName: 'design/bold/home.html' }] }
    ])
    const saved: unknown = JSON.parse(await readFile(join(requestFolder, 'request.json'), 'utf8'))
    expect(saved).toMatchObject({ gentleDesignSlug: 'bold' })
  })

  it('shows no set when the binding cannot be kept, so a later design folder cannot take it', async () => {
    // A directory where request.json goes: the new manifest cannot be renamed over it.
    await mkdir(join(requestFolder, 'request.json'))

    expect(await gentleDesignSetFor(requestFolder, manifestWith(), launchDirectory)).toBeNull()
  })

  it('reads no design folder when request.json names another directory than the chat launched in', async () => {
    const manifest = manifestWith({ sessionCwd: join(root, 'elsewhere') })

    expect(await gentleDesignSetFor(requestFolder, manifest, launchDirectory)).toBeNull()
  })

  it('keeps a slug written into request.json only when it was not a design folder at the send', async () => {
    expect(
      await gentleDesignSetFor(
        requestFolder,
        manifestWith({ gentleDesignSlug: 'bold', gentleDesignBaseline: ['bold'] }),
        launchDirectory
      )
    ).toBeNull()
    expect(
      await gentleDesignSetFor(
        requestFolder,
        manifestWith({ gentleDesignSlug: 'bold' }),
        launchDirectory
      )
    ).not.toBeNull()
  })

  it('binds the slug without reverting a version another writer persisted after the caller read request.json', async () => {
    const read = manifestWith()
    await writeFile(
      join(requestFolder, 'request.json'),
      JSON.stringify({ ...read, designSystemVersion: 3 })
    )

    const set = await gentleDesignSetFor(requestFolder, read, launchDirectory)

    expect(set?.directions).toEqual([
      { letter: 'A', versions: [{ version: 1, fileName: 'design/bold/home.html' }] }
    ])
    expect(await readSavedManifest()).toMatchObject({
      gentleDesignSlug: 'bold',
      designSystemVersion: 3
    })
  })
})

describe('recordRequestDesignSystemVersion', () => {
  it('writes the version into the request.json on disk', async () => {
    await writeFile(
      join(requestFolder, 'request.json'),
      JSON.stringify(manifestWith({ agent: 'claude', designSystemMode: 'use' }))
    )

    expect(await recordRequestDesignSystemVersion(requestFolder, 2)).toBe(2)
    expect(await readSavedManifest()).toMatchObject({ designSystemVersion: 2 })
  })

  it('keeps a field another writer persisted after the caller read request.json', async () => {
    const read = manifestWith({ agent: 'claude', designSystemMode: 'use' })
    await writeFile(
      join(requestFolder, 'request.json'),
      JSON.stringify({ ...read, gentleDesignSlug: 'bold' })
    )

    expect(await recordRequestDesignSystemVersion(requestFolder, 2)).toBe(2)
    expect(await readSavedManifest()).toMatchObject({
      gentleDesignSlug: 'bold',
      designSystemVersion: 2
    })
  })

  it('keeps a version already on disk rather than replacing it', async () => {
    await writeFile(
      join(requestFolder, 'request.json'),
      JSON.stringify(manifestWith({ agent: 'claude', designSystemVersion: 1 }))
    )

    expect(await recordRequestDesignSystemVersion(requestFolder, 2)).toBe(1)
    expect(await readSavedManifest()).toMatchObject({ designSystemVersion: 1 })
  })

  it('writes nothing when request.json cannot be read', async () => {
    expect(await recordRequestDesignSystemVersion(requestFolder, 2)).toBeUndefined()
    await expect(readFile(join(requestFolder, 'request.json'), 'utf8')).rejects.toThrow()

    await writeFile(join(requestFolder, 'request.json'), 'not json')
    expect(await recordRequestDesignSystemVersion(requestFolder, 2)).toBeUndefined()
    expect(await readFile(join(requestFolder, 'request.json'), 'utf8')).toBe('not json')
  })
})

async function readSavedManifest(): Promise<unknown> {
  return JSON.parse(await readFile(join(requestFolder, 'request.json'), 'utf8'))
}
