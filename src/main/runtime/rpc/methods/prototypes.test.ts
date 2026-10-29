import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

/** A request folder of one chat with one direction, written as the host would have written it. */
async function writeSetFor(sessionId: string, requestId: string): Promise<void> {
  const folder = join(
    nativeChatVisualsFolderFor(stateDirectory, sessionId),
    'prototypes',
    requestId
  )
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
      createdAt: '2026-10-28T20:15:00.000Z'
    })
  )
  await writeFile(join(folder, 'A.html'), '<p>a</p>')
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

  it('lists every chat to this desktop, but to a paired device only the chats the host still keeps', async () => {
    await writeSetFor(SESSION, '20261028-201500-kept00')
    await writeSetFor('session-gone-0003', '20261028-201500-gone00')

    const desktop = { ...STRUCTURED_CLIENT, caller: { kind: 'desktop' as const } }
    expect(replyResult(await call('prototypes.list', {}, desktop))).toMatchObject({
      sets: expect.arrayContaining([
        expect.objectContaining({ sessionId: SESSION }),
        expect.objectContaining({ sessionId: 'session-gone-0003' })
      ])
    })
    const pairedDevice = {
      ...STRUCTURED_CLIENT,
      caller: { kind: 'paired-device' as const, deviceId: 'device-1' }
    }
    expect(replyResult(await call('prototypes.list', {}, pairedDevice))).toMatchObject({
      sets: [expect.objectContaining({ sessionId: SESSION })]
    })
    // Why: a client that names no identity is not the owner, so it lists only the kept chats too.
    expect(replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))).toMatchObject({
      sets: [expect.objectContaining({ sessionId: SESSION })]
    })
  })

  it('readFile answers not_found for a chat with no record or a WSL chat', async () => {
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
    ).toEqual({ ok: false, error: 'not_found' })
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

describe('prototypes design system', () => {
  const TOKENS = JSON.stringify({
    color: { primary: { $value: '#2563eb' } },
    $extensions: { massorca: { version: 4, status: 'detected' } }
  })

  async function writeSystem(root: string, files: Record<string, string>): Promise<void> {
    await mkdir(join(root, 'design', 'system'), { recursive: true })
    for (const [name, text] of Object.entries(files)) {
      await writeFile(join(root, 'design', 'system', name), text)
    }
  }

  it('readDesignSystem is registered and a phone may call it', () => {
    expect(ALL_RPC_METHODS.map((method) => method.name)).toContain('prototypes.readDesignSystem')
    expect(MOBILE_AGENT_SESSION_RPC_METHODS).toContain('prototypes.readDesignSystem')
  })

  it('readDesignSystem returns the files under the project root, found from a nested launch directory', async () => {
    const root = launchDirectory
    await mkdir(join(root, '.git'))
    await writeSystem(root, { 'tokens.json': TOKENS, 'system.md': '# rules' })
    const nested = join(root, 'packages', 'app')
    await mkdir(nested, { recursive: true })
    record = { ...agentSessionRecordFixture(), sessionId: SESSION, launchDirectory: nested }

    const result = replyResult(
      await call('prototypes.readDesignSystem', { sessionId: SESSION }, STRUCTURED_CLIENT)
    )

    expect(result).toEqual({
      ok: true,
      projectKey: expect.stringMatching(/^[0-9a-f]{16}$/u),
      projectName: expect.any(String),
      fileNames: ['design/system/tokens.json', 'design/system/system.md'],
      tokensJson: TOKENS,
      systemMd: '# rules'
    })
  })

  it('readDesignSystem answers with no files for a project without a system', async () => {
    const result = replyResult(
      await call('prototypes.readDesignSystem', { sessionId: SESSION }, STRUCTURED_CLIENT)
    )
    expect(result).toMatchObject({ ok: true, fileNames: [] })
    expect(result).not.toHaveProperty('tokensJson')
  })

  it('readDesignSystem answers not_found for a missing, WSL, SSH or directory-less chat', async () => {
    const ask = async (): Promise<unknown> =>
      replyResult(
        await call('prototypes.readDesignSystem', { sessionId: SESSION }, STRUCTURED_CLIENT)
      )
    const base = agentSessionRecordFixture()
    record = null
    expect(await ask()).toEqual({ ok: false, error: 'not_found' })
    record = { ...base, sessionId: SESSION, location: { ...base.location, wslDistro: 'Ubuntu' } }
    expect(await ask()).toEqual({ ok: false, error: 'not_found' })
    record = {
      ...base,
      sessionId: SESSION,
      location: { ...base.location, executionHostId: 'ssh:box' }
    }
    expect(await ask()).toEqual({ ok: false, error: 'not_found' })
    const { launchDirectory: _dropped, ...withoutDirectory } = base
    record = { ...withoutDirectory, sessionId: SESSION }
    expect(await ask()).toEqual({ ok: false, error: 'not_found' })
  })

  it('readDesignSystem refuses a parameter the schema does not name', async () => {
    const reply = await call(
      'prototypes.readDesignSystem',
      { sessionId: SESSION, path: '/etc' },
      STRUCTURED_CLIENT
    )
    expect(reply.ok).toBe(false)
  })

  it('list summarizes the design system of each project once and tags its sets', async () => {
    await mkdir(join(launchDirectory, '.git'))
    await writeSystem(launchDirectory, {
      'tokens.json': JSON.stringify({
        color: { primary: { $value: '#2563eb' }, border: { $value: '#eee' } },
        $extensions: { massorca: { version: 4, status: 'proposed', agent: 'Codex' } }
      })
    })
    await writeSetFor(SESSION, '20261028-201500-aaaaaa')
    await writeSetFor(SESSION, '20261028-201600-bbbbbb')

    const result = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))

    expect(result).toMatchObject({
      sets: [
        expect.objectContaining({
          projectKey: expect.any(String),
          projectName: expect.any(String)
        }),
        expect.objectContaining({ projectKey: expect.any(String) })
      ],
      designSystems: [
        {
          projectKey: expect.any(String),
          projectName: expect.any(String),
          status: 'proposed',
          version: 4,
          tokenCount: 2,
          agent: 'Codex',
          swatches: ['#2563eb', '#eee']
        }
      ]
    })
  })

  it('list sends no design systems for a project without one', async () => {
    await writeSetFor(SESSION, '20261028-201500-aaaaaa')
    const result = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))
    expect(result).not.toHaveProperty('designSystems')
  })

  async function requestManifest(requestId: string): Promise<Record<string, unknown>> {
    const folder = join(
      nativeChatVisualsFolderFor(stateDirectory, SESSION),
      'prototypes',
      requestId
    )
    const manifest: Record<string, unknown> = JSON.parse(
      await readFile(join(folder, 'request.json'), 'utf8')
    )
    return manifest
  }

  async function editRequestManifest(
    requestId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const folder = join(
      nativeChatVisualsFolderFor(stateDirectory, SESSION),
      'prototypes',
      requestId
    )
    const manifest = await requestManifest(requestId)
    await writeFile(join(folder, 'request.json'), JSON.stringify({ ...manifest, ...patch }))
  }

  it('list records the system version a request is first seen built on, and keeps it', async () => {
    const requestId = '20261028-201500-aaaaaa'
    await mkdir(join(launchDirectory, '.git'))
    await writeSystem(launchDirectory, {
      'tokens.json': JSON.stringify({ $extensions: { massorca: { version: 4 } } })
    })
    await writeSetFor(SESSION, requestId)
    await editRequestManifest(requestId, { designSystemMode: 'propose' })

    const first = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))
    expect(first).toMatchObject({ sets: [expect.objectContaining({ builtOn: 4 })] })
    expect(await requestManifest(requestId)).toMatchObject({ designSystemVersion: 4 })

    await writeSystem(launchDirectory, {
      'tokens.json': JSON.stringify({ $extensions: { massorca: { version: 5 } } })
    })
    const second = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))
    expect(second).toMatchObject({ sets: [expect.objectContaining({ builtOn: 4 })] })
    expect(await requestManifest(requestId)).toMatchObject({ designSystemVersion: 4 })
  })

  it('list records no version for a request that skipped the design system', async () => {
    const requestId = '20261028-201500-bbbbbb'
    await mkdir(join(launchDirectory, '.git'))
    await writeSystem(launchDirectory, {
      'tokens.json': JSON.stringify({ $extensions: { massorca: { version: 2 } } })
    })
    await writeSetFor(SESSION, requestId)
    await editRequestManifest(requestId, { designSystemMode: 'skip' })

    const listed = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))

    expect(listed).toMatchObject({ sets: [expect.objectContaining({ requestId })] })
    expect(listed).toMatchObject({ sets: [expect.not.objectContaining({ builtOn: 2 })] })
    expect(await requestManifest(requestId)).not.toHaveProperty('designSystemVersion')
  })

  it('list records no version for a request whose project has no system yet', async () => {
    const requestId = '20261028-201500-cccccc'
    await writeSetFor(SESSION, requestId)
    await editRequestManifest(requestId, { designSystemMode: 'use' })

    const listed = replyResult(await call('prototypes.list', {}, STRUCTURED_CLIENT))

    expect(listed).toMatchObject({ sets: [expect.objectContaining({ requestId })] })
    expect(listed).toMatchObject({ sets: [expect.not.objectContaining({ builtOn: 2 })] })
    expect(await requestManifest(requestId)).not.toHaveProperty('designSystemVersion')
  })

  it('createRequest records the choice and the version the system has now', async () => {
    await mkdir(join(launchDirectory, '.git'))
    await writeSystem(launchDirectory, { 'tokens.json': TOKENS })
    const created = replyResult(
      await call(
        'prototypes.createRequest',
        { sessionId: SESSION, agent: 'claude', originalPrompt: 'x', count: 1, designSystem: 'use' },
        STRUCTURED_CLIENT
      )
    )
    const folderPath =
      typeof created === 'object' && created !== null && 'folderPath' in created
        ? String(created.folderPath)
        : ''
    const manifest: unknown = JSON.parse(await readFile(join(folderPath, 'request.json'), 'utf8'))
    expect(manifest).toMatchObject({ designSystemMode: 'use', designSystemVersion: 4 })
  })

  it('createRequest records no version for Skip or when the project has no system', async () => {
    await mkdir(join(launchDirectory, '.git'))
    await writeSystem(launchDirectory, { 'tokens.json': TOKENS })
    const manifestOf = async (designSystem: 'skip' | 'propose'): Promise<unknown> => {
      const created = replyResult(
        await call(
          'prototypes.createRequest',
          { sessionId: SESSION, agent: 'claude', originalPrompt: 'x', count: 1, designSystem },
          STRUCTURED_CLIENT
        )
      )
      const folderPath =
        typeof created === 'object' && created !== null && 'folderPath' in created
          ? String(created.folderPath)
          : ''
      return JSON.parse(await readFile(join(folderPath, 'request.json'), 'utf8'))
    }
    const skipped = await manifestOf('skip')
    expect(skipped).toMatchObject({ designSystemMode: 'skip' })
    expect(skipped).not.toHaveProperty('designSystemVersion')
    await rm(join(launchDirectory, 'design'), { recursive: true })
    expect(await manifestOf('propose')).not.toHaveProperty('designSystemVersion')
  })
})
