import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nativeChatVisualsFolderFor } from './native-chat-visuals-folder'
import { isLocalChatWorkingDirectoryGone } from './prototype-request-deletability'
import { deletePrototypeRequest, setPrototypeRequestArchived } from './prototype-request-lifecycle'
import { listPrototypeSets } from './prototype-requests'

const SESSION = 'session-test-0001'
const REQUEST = '20261028-201500-aaaaaa'

let stateDirectory: string
let scratch: string

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-lifecycle-'))
  scratch = await mkdtemp(join(tmpdir(), 'orca-prototypes-lifecycle-scratch-'))
})

afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(scratch, { recursive: true, force: true })
})

function folderOf(requestId: string, sessionId = SESSION): string {
  return join(nativeChatVisualsFolderFor(stateDirectory, sessionId), 'prototypes', requestId)
}

async function writeSet(requestId: string, extra: Record<string, unknown> = {}): Promise<void> {
  const folder = folderOf(requestId)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'request.json'),
    JSON.stringify({
      version: 1,
      requestId,
      agent: 'claude',
      sessionId: SESSION,
      originalPrompt: 'a dashboard',
      count: 1,
      createdAt: '2026-10-28T20:15:00.000Z',
      ...extra
    })
  )
  await writeFile(join(folder, 'A.html'), '<p>a</p>')
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

const everyone = (): boolean => true

describe('deletePrototypeRequest', () => {
  it('removes the request folder and nothing beside it', async () => {
    await writeSet(REQUEST)
    await writeSet('20261028-201500-bbbbbb')
    const result = await deletePrototypeRequest({
      stateDirectory,
      sessionId: SESSION,
      requestId: REQUEST,
      canAct: everyone,
      isDeletable: async () => true
    })
    expect(result).toEqual({ ok: true })
    expect(await exists(folderOf(REQUEST))).toBe(false)
    expect(await exists(folderOf('20261028-201500-bbbbbb'))).toBe(true)
  })

  it('does not ask whether the set is deletable for a request it cannot find', async () => {
    const isDeletable = vi.fn(async () => true)
    const result = await deletePrototypeRequest({
      stateDirectory,
      sessionId: SESSION,
      requestId: REQUEST,
      canAct: everyone,
      isDeletable
    })
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(isDeletable).not.toHaveBeenCalled()
  })

  it('refuses ids that are paths, whatever the schema let through', async () => {
    await writeSet(REQUEST)
    for (const requestId of ['..', `../${REQUEST}`, `${REQUEST}/..`, '.', '']) {
      expect(
        await deletePrototypeRequest({
          stateDirectory,
          sessionId: SESSION,
          requestId,
          canAct: everyone,
          isDeletable: async () => true
        })
      ).toEqual({ ok: false, error: 'not_found' })
    }
    expect(await exists(folderOf(REQUEST))).toBe(true)
  })

  it('refuses a request folder that is a link out of the visuals root, and leaves the target', async () => {
    const outside = join(scratch, 'precious')
    await mkdir(outside)
    await writeFile(join(outside, 'request.json'), '{}')
    await mkdir(join(nativeChatVisualsFolderFor(stateDirectory, SESSION), 'prototypes'), {
      recursive: true
    })
    try {
      await symlink(outside, folderOf(REQUEST), 'junction')
    } catch {
      return
    }
    expect(
      await deletePrototypeRequest({
        stateDirectory,
        sessionId: SESSION,
        requestId: REQUEST,
        canAct: everyone,
        isDeletable: async () => true
      })
    ).toEqual({ ok: false, error: 'not_found' })
    expect(await exists(join(outside, 'request.json'))).toBe(true)
  })

  it('answers not_found when the caller may not act on the request', async () => {
    await writeSet(REQUEST)
    expect(
      await deletePrototypeRequest({
        stateDirectory,
        sessionId: SESSION,
        requestId: REQUEST,
        canAct: () => false,
        isDeletable: async () => true
      })
    ).toEqual({ ok: false, error: 'not_found' })
    expect(await exists(folderOf(REQUEST))).toBe(true)
  })
})

describe('setPrototypeRequestArchived', () => {
  it('refuses a manifest that is not valid, and writes nothing', async () => {
    await mkdir(folderOf(REQUEST), { recursive: true })
    await writeFile(join(folderOf(REQUEST), 'request.json'), '{"version":1}')
    expect(
      await setPrototypeRequestArchived({
        stateDirectory,
        sessionId: SESSION,
        requestId: REQUEST,
        archived: true,
        canAct: everyone
      })
    ).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('listing archived sets', () => {
  it('marks an archived set, and asks about deletability once per chat', async () => {
    await writeSet(REQUEST, { archived: true })
    await writeSet('20261028-201500-bbbbbb', { archived: true })
    await writeSet('20261028-201500-cccccc')
    const isDeletable = vi.fn(async () => true)

    const { sets } = await listPrototypeSets({ stateDirectory, isDeletable })

    expect(sets.filter((set) => set.archived === true).map((set) => set.deletable)).toEqual([
      true,
      true
    ])
    expect(isDeletable).toHaveBeenCalledTimes(1)
  })

  it('lists a set whose chat is gone as deletable without archiving it first', async () => {
    await writeSet(REQUEST)
    const { sets } = await listPrototypeSets({ stateDirectory, isDeletable: async () => true })
    expect(sets[0]).not.toHaveProperty('archived')
    expect(sets[0]).toMatchObject({ deletable: true })
  })

  it('lists an archived set as not deletable when the check fails', async () => {
    await writeSet(REQUEST, { archived: true })
    const { sets } = await listPrototypeSets({
      stateDirectory,
      isDeletable: async () => {
        throw new Error('boom')
      }
    })
    expect(sets[0]).toMatchObject({ archived: true })
    expect(sets[0]).not.toHaveProperty('deletable')
  })
})

describe('isLocalChatWorkingDirectoryGone', () => {
  const location = {
    executionHostId: 'local',
    wslDistro: null,
    workspaceId: 'workspace-1',
    workspaceKind: 'git-worktree'
  } as const

  it('is false for a directory that exists and true for one that does not', async () => {
    expect(
      await isLocalChatWorkingDirectoryGone({ location, launchDirectory: scratch }, undefined)
    ).toBe(false)
    expect(
      await isLocalChatWorkingDirectoryGone(
        { location, launchDirectory: join(scratch, 'absent') },
        undefined
      )
    ).toBe(true)
  })

  it('resolves a workspace without a pinned directory, and counts one the host cannot resolve as gone', async () => {
    expect(await isLocalChatWorkingDirectoryGone({ location }, async () => scratch)).toBe(false)
    expect(
      await isLocalChatWorkingDirectoryGone({ location }, async () => join(scratch, 'absent'))
    ).toBe(true)
    expect(
      await isLocalChatWorkingDirectoryGone({ location }, async () => {
        throw new Error('unknown workspace')
      })
    ).toBe(true)
  })

  it('is false when there is neither a pinned directory nor a resolver to ask', async () => {
    expect(await isLocalChatWorkingDirectoryGone({ location }, undefined)).toBe(false)
  })
})
