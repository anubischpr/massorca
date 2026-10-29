import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../../../shared/agent-session-record.test-fixture'
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

function call(method: string, params: unknown, client: CallClient) {
  return callStructured(method, params, client, {}, STRUCTURED_AGENT_SESSION_PROTOTYPE_METHODS)
}

let stateDirectory: string
let launchDirectory: string
vi.mock('../../../orca-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => stateDirectory
}))
let record: AgentSessionRecord | null

beforeEach(async () => {
  stateDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-rpc-'))
  launchDirectory = await mkdtemp(join(tmpdir(), 'orca-prototypes-launch-'))
  record = { ...agentSessionRecordFixture(), sessionId: SESSION, launchDirectory }
  setStructuredAgentSessionHost(
    Object.assign(hostStub(), {
      deps: {
        store: { getRecord: (id: string) => (record?.sessionId === id ? record : null) }
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

describe('prototypes.*', () => {
  it('are registered on the runtime manifest', () => {
    const names = ALL_RPC_METHODS.map((method) => method.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'prototypes.createRequest',
        'prototypes.list',
        'prototypes.readFile',
        'prototypes.writeAttachment'
      ])
    )
  })

  it('createRequest makes a request folder for a local chat and returns its host path', async () => {
    const reply = await call(
      'prototypes.createRequest',
      { sessionId: SESSION, agent: 'claude', originalPrompt: 'a dashboard', count: 2 },
      STRUCTURED_CLIENT
    )
    const result = replyResult(reply)
    expect(result).toMatchObject({ ok: true, requestId: expect.any(String) })
    const folderPath =
      typeof result === 'object' && result !== null && 'folderPath' in result
        ? String(result.folderPath)
        : ''
    expect(folderPath.startsWith(nativeChatVisualsFolderFor(stateDirectory, SESSION))).toBe(true)
  })

  it('createRequest answers unsupported for a chat this host has no record of', async () => {
    record = null
    const reply = await call(
      'prototypes.createRequest',
      { sessionId: SESSION, agent: 'claude', originalPrompt: 'x', count: 1 },
      STRUCTURED_CLIENT
    )
    expect(replyResult(reply)).toEqual({ ok: false, error: 'unsupported' })
  })

  it('createRequest answers unsupported for a WSL or SSH chat', async () => {
    const base = agentSessionRecordFixture()
    record = { ...base, sessionId: SESSION, location: { ...base.location, wslDistro: 'Ubuntu' } }
    const wsl = await call(
      'prototypes.createRequest',
      { sessionId: SESSION, agent: 'claude', originalPrompt: 'x', count: 1 },
      STRUCTURED_CLIENT
    )
    expect(replyResult(wsl)).toEqual({ ok: false, error: 'unsupported' })

    record = {
      ...base,
      sessionId: SESSION,
      location: { ...base.location, executionHostId: 'ssh:box' }
    }
    const ssh = await call(
      'prototypes.createRequest',
      { sessionId: SESSION, agent: 'claude', originalPrompt: 'x', count: 1 },
      STRUCTURED_CLIENT
    )
    expect(replyResult(ssh)).toEqual({ ok: false, error: 'unsupported' })
  })

  it('writeAttachment writes a note into the request folder of a local chat', async () => {
    const made = await call(
      'prototypes.createRequest',
      { sessionId: SESSION, agent: 'claude', originalPrompt: 'a dashboard', count: 2 },
      STRUCTURED_CLIENT
    )
    const createdResult = replyResult(made)
    const requestId =
      typeof createdResult === 'object' && createdResult !== null && 'requestId' in createdResult
        ? String(createdResult.requestId)
        : ''
    const pngBase64 = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('note')
    ]).toString('base64')

    const reply = await call(
      'prototypes.writeAttachment',
      { sessionId: SESSION, requestId, name: 'note-1', pngBase64 },
      STRUCTURED_CLIENT
    )

    expect(replyResult(reply)).toEqual({
      ok: true,
      path: join(
        nativeChatVisualsFolderFor(stateDirectory, SESSION),
        'prototypes',
        requestId,
        'notes',
        'note-1.png'
      )
    })
  })

  it('writeAttachment answers unsupported for a chat this host has no record of', async () => {
    record = null
    const reply = await call(
      'prototypes.writeAttachment',
      {
        sessionId: SESSION,
        requestId: '20261028-201500-aaaaaa',
        name: 'note-1',
        pngBase64: 'iVBORw0KGgo='
      },
      STRUCTURED_CLIENT
    )
    expect(replyResult(reply)).toEqual({ ok: false, error: 'unsupported' })
  })

  it('writeAttachment rejects a note name with a separator at the schema', async () => {
    const reply = await call(
      'prototypes.writeAttachment',
      {
        sessionId: SESSION,
        requestId: '20261028-201500-aaaaaa',
        name: 'a/b',
        pngBase64: 'iVBORw0KGgo='
      },
      STRUCTURED_CLIENT
    )
    expect(reply.ok).toBe(false)
  })

  it('refuses a parameter the schema does not name', async () => {
    const reply = await call(
      'prototypes.list',
      { worktreeId: 'wt-1', path: '/etc' },
      STRUCTURED_CLIENT
    )
    expect(reply.ok).toBe(false)
  })

  it('list returns the sets of this host for the worktree asked', async () => {
    const reply = await call('prototypes.list', { worktreeId: 'wt-1' }, STRUCTURED_CLIENT)
    expect(replyResult(reply)).toEqual({ sets: [] })
  })

  it('readFile answers not_found for a chat with no record and unreadable for a WSL chat', async () => {
    const fileName = 'prototypes/20261028-201500-aaaaaa/A.html'
    record = null
    expect(
      replyResult(
        await call(
          'prototypes.readFile',
          { sessionId: SESSION, requestId: '20261028-201500-aaaaaa', fileName },
          STRUCTURED_CLIENT
        )
      )
    ).toEqual({ ok: false, error: 'not_found' })

    const base = agentSessionRecordFixture()
    record = { ...base, sessionId: SESSION, location: { ...base.location, wslDistro: 'Ubuntu' } }
    expect(
      replyResult(
        await call(
          'prototypes.readFile',
          { sessionId: SESSION, requestId: '20261028-201500-aaaaaa', fileName },
          STRUCTURED_CLIENT
        )
      )
    ).toEqual({ ok: false, error: 'unreadable' })
  })

  it('readFile returns the HTML of a set file of a request on this host', async () => {
    const created = replyResult(
      await call(
        'prototypes.createRequest',
        { sessionId: SESSION, agent: 'claude', originalPrompt: 'a dashboard', count: 2 },
        STRUCTURED_CLIENT
      )
    )
    const requestId =
      typeof created === 'object' && created !== null && 'requestId' in created
        ? String(created.requestId)
        : ''
    const folder = join(
      nativeChatVisualsFolderFor(stateDirectory, SESSION),
      'prototypes',
      requestId
    )
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'A.html'), '<p>a</p>')

    const reply = await call(
      'prototypes.readFile',
      { sessionId: SESSION, requestId, fileName: `prototypes/${requestId}/A.html` },
      STRUCTURED_CLIENT
    )
    expect(replyResult(reply)).toEqual({ ok: true, html: '<p>a</p>' })
  })
})
