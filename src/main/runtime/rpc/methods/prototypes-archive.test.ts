import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../../../shared/agent-session-record.test-fixture'
import { MOBILE_AGENT_SESSION_RPC_METHODS } from '../../runtime-rpc/runtime-rpc-mobile-agent-session-methods'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { nativeChatVisualsFolderFor } from '../../../native-chat/native-chat-visuals-folder'
import { ALL_RPC_METHODS } from '.'
import { STRUCTURED_AGENT_SESSION_PROTOTYPE_METHODS } from './prototypes'
import {
  call as callStructured,
  clearStructuredHostStub,
  hostStub,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

type CallClient = Parameters<typeof callStructured>[2]

const DESKTOP = { ...STRUCTURED_CLIENT, caller: { kind: 'desktop' as const } }
const PHONE = {
  ...STRUCTURED_CLIENT,
  caller: { kind: 'paired-device' as const, deviceId: 'device-1' }
}
const GONE = 'session-gone-0003'
const REQUEST = '20261028-201500-aaaaaa'
const OTHER_REQUEST = '20261028-201500-bbbbbb'

function call(method: string, params: unknown, client: CallClient = DESKTOP) {
  return callStructured(method, params, client, {}, STRUCTURED_AGENT_SESSION_PROTOTYPE_METHODS)
}

let stateDirectory: string
let launchDirectory: string
vi.mock('../../../orca-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => stateDirectory
}))
let record: AgentSessionRecord | null

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-archive-'))
  launchDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-archive-launch-'))
  record = { ...agentSessionRecordFixture(), sessionId: SESSION, launchDirectory }
  setStructuredAgentSessionHost(
    Object.assign(hostStub(), {
      deps: {
        store: {
          getRecord: (id: string) => (record?.sessionId === id ? record : null),
          listRecords: () => (record ? [record] : [])
        }
      }
    })
  )
})

afterEach(async () => {
  clearStructuredHostStub()
  await rm(stateDirectory, { recursive: true, force: true })
  await rm(launchDirectory, { recursive: true, force: true })
})

function replyResult(reply: { ok: boolean; result?: unknown }): unknown {
  return reply.ok ? reply.result : undefined
}

function requestFolderOf(sessionId: string, requestId: string): string {
  return join(nativeChatVisualsFolderFor(stateDirectory, sessionId), 'prototypes', requestId)
}

async function writeSetFor(
  sessionId: string,
  requestId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const folder = requestFolderOf(sessionId, requestId)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'request.json'),
    JSON.stringify({
      version: 1,
      requestId,
      agent: 'claude',
      sessionId,
      originalPrompt: 'a dashboard',
      count: 2,
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

async function manifestOf(sessionId: string, requestId: string): Promise<unknown> {
  return JSON.parse(
    await readFile(join(requestFolderOf(sessionId, requestId), 'request.json'), 'utf8')
  )
}

async function listed(client: CallClient): Promise<Record<string, unknown>[]> {
  const result = replyResult(await call('prototypes.list', {}, client))
  if (typeof result !== 'object' || result === null || !('sets' in result)) {
    return []
  }
  return Array.isArray(result.sets) ? result.sets : []
}

describe('prototypes.archive and prototypes.unarchive', () => {
  it('are registered, and a phone may call them', () => {
    const names = ALL_RPC_METHODS.map((method) => method.name)
    for (const method of ['prototypes.archive', 'prototypes.unarchive', 'prototypes.delete']) {
      expect(names).toContain(method)
      expect(MOBILE_AGENT_SESSION_RPC_METHODS).toContain(method)
    }
  })

  it('archives a set whose chat lives, lists it archived, and unarchives it again', async () => {
    await writeSetFor(SESSION, REQUEST, { someFutureField: { keep: 'me' } })

    expect(
      replyResult(await call('prototypes.archive', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: true })
    expect(await listed(DESKTOP)).toEqual([
      expect.objectContaining({ requestId: REQUEST, archived: true })
    ])
    // Why: a field this host does not know belongs to a newer one and must survive the rewrite.
    expect(await manifestOf(SESSION, REQUEST)).toMatchObject({
      archived: true,
      someFutureField: { keep: 'me' }
    })

    expect(
      replyResult(await call('prototypes.unarchive', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: true })
    expect((await listed(DESKTOP))[0]).not.toHaveProperty('archived')
    const manifest = await manifestOf(SESSION, REQUEST)
    expect(manifest).not.toHaveProperty('archived')
    expect(manifest).toMatchObject({ someFutureField: { keep: 'me' } })
  })

  it('answers not_found for a request that is not on this host', async () => {
    expect(
      replyResult(await call('prototypes.archive', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: false, error: 'not_found' })
  })

  it('archives a set of a remote chat for the desktop, but a phone cannot reach it', async () => {
    const base = agentSessionRecordFixture()
    record = {
      ...base,
      sessionId: SESSION,
      location: { ...base.location, executionHostId: 'ssh:box' }
    }
    await writeSetFor(SESSION, REQUEST)
    expect(
      replyResult(
        await call('prototypes.archive', { sessionId: SESSION, requestId: REQUEST }, PHONE)
      )
    ).toEqual({ ok: false, error: 'not_found' })
    expect(
      replyResult(await call('prototypes.archive', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: true })
  })

  it('refuses an id that is a path, and a parameter the schema does not name', async () => {
    for (const requestId of ['..', '../x', 'a/b', 'a\\b', '']) {
      for (const method of ['prototypes.archive', 'prototypes.unarchive', 'prototypes.delete']) {
        expect((await call(method, { sessionId: SESSION, requestId })).ok).toBe(false)
      }
    }
    expect(
      (await call('prototypes.delete', { sessionId: SESSION, requestId: REQUEST, path: '/etc' })).ok
    ).toBe(false)
  })
})

describe('prototypes.delete', () => {
  it('refuses while the chat and its directory exist, and leaves the folder', async () => {
    await writeSetFor(SESSION, REQUEST)
    expect(
      replyResult(await call('prototypes.delete', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: false, error: 'not_deletable' })
    expect(await exists(requestFolderOf(SESSION, REQUEST))).toBe(true)
  })

  it('deletes only that request when the chat record is gone', async () => {
    await writeSetFor(GONE, REQUEST)
    await writeSetFor(GONE, OTHER_REQUEST)
    await writeSetFor(SESSION, REQUEST)

    expect(
      replyResult(await call('prototypes.delete', { sessionId: GONE, requestId: REQUEST }))
    ).toEqual({ ok: true })

    expect(await exists(requestFolderOf(GONE, REQUEST))).toBe(false)
    expect(await exists(requestFolderOf(GONE, OTHER_REQUEST))).toBe(true)
    expect(await exists(requestFolderOf(SESSION, REQUEST))).toBe(true)
  })

  it('deletes when the chat lives but its directory no longer exists', async () => {
    await writeSetFor(SESSION, REQUEST)
    await rm(launchDirectory, { recursive: true, force: true })
    expect(
      replyResult(await call('prototypes.delete', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: true })
    expect(await exists(requestFolderOf(SESSION, REQUEST))).toBe(false)
  })

  it('does not take a chat on another host for a deleted one', async () => {
    const base = agentSessionRecordFixture()
    const missingDirectory = join(launchDirectory, 'absent')
    record = {
      ...base,
      sessionId: SESSION,
      launchDirectory: missingDirectory,
      location: { ...base.location, executionHostId: 'ssh:box' }
    }
    await writeSetFor(SESSION, REQUEST)
    expect(
      replyResult(await call('prototypes.delete', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: false, error: 'not_deletable' })
    record = {
      ...base,
      sessionId: SESSION,
      launchDirectory: missingDirectory,
      location: { ...base.location, wslDistro: 'Ubuntu' }
    }
    expect(
      replyResult(await call('prototypes.delete', { sessionId: SESSION, requestId: REQUEST }))
    ).toEqual({ ok: false, error: 'not_deletable' })
    expect(await exists(requestFolderOf(SESSION, REQUEST))).toBe(true)
  })

  it('answers not_found for a request whose manifest names another session', async () => {
    await writeSetFor(GONE, REQUEST, { sessionId: 'someone-else' })
    expect(
      replyResult(await call('prototypes.delete', { sessionId: GONE, requestId: REQUEST }))
    ).toEqual({ ok: false, error: 'not_found' })
    expect(await exists(requestFolderOf(GONE, REQUEST))).toBe(true)
  })
})

describe('the Archived group on a phone', () => {
  it('lists a set whose chat is gone only once it is archived, and marks it deletable', async () => {
    await writeSetFor(GONE, REQUEST)
    expect(await listed(PHONE)).toEqual([])

    await call('prototypes.archive', { sessionId: GONE, requestId: REQUEST })
    expect(await listed(PHONE)).toEqual([
      expect.objectContaining({ requestId: REQUEST, archived: true, deletable: true })
    ])
  })

  it('does not mark an archived set deletable while its chat lives', async () => {
    await writeSetFor(SESSION, REQUEST, { archived: true })
    const [set] = await listed(PHONE)
    expect(set).toMatchObject({ requestId: REQUEST, archived: true })
    expect(set).not.toHaveProperty('deletable')
  })

  it('cannot reach a hidden set of a gone chat, but can delete it once it is archived', async () => {
    await writeSetFor(GONE, REQUEST)
    for (const method of ['prototypes.archive', 'prototypes.delete']) {
      expect(
        replyResult(await call(method, { sessionId: GONE, requestId: REQUEST }, PHONE))
      ).toEqual({ ok: false, error: 'not_found' })
    }

    await call('prototypes.archive', { sessionId: GONE, requestId: REQUEST })
    expect(
      replyResult(await call('prototypes.delete', { sessionId: GONE, requestId: REQUEST }, PHONE))
    ).toEqual({ ok: true })
    expect(await exists(requestFolderOf(GONE, REQUEST))).toBe(false)
  })

  it('still reads no file of a gone chat', async () => {
    await writeSetFor(GONE, REQUEST, { archived: true })
    expect(
      replyResult(
        await call(
          'prototypes.readFile',
          { sessionId: GONE, requestId: REQUEST, fileName: `prototypes/${REQUEST}/A.html` },
          PHONE
        )
      )
    ).toEqual({ ok: false, error: 'not_found' })
  })
})
