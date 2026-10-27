import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { agentSessionRecordFixture } from '../../../../shared/agent-session-record.test-fixture'
import {
  AGENT_SESSION_RECORDED_FILE_READ_RUNTIME_CAPABILITY,
  RUNTIME_CAPABILITIES
} from '../../../../shared/protocol-version'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { ALL_RPC_METHODS } from '.'
import { STRUCTURED_AGENT_SESSION_RECORDED_FILE_METHODS } from './structured-agent-session-recorded-file'
import {
  call as callStructured,
  clearStructuredHostStub,
  hostStub,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

let root: string
let record: AgentSessionRecord | null
let items: AgentJournalRenderItem[]

const call = (params: unknown) =>
  callStructured(
    'agentSession.readRecordedFile',
    params,
    STRUCTURED_CLIENT,
    {},
    STRUCTURED_AGENT_SESSION_RECORDED_FILE_METHODS
  )

function writeCall(
  sequence: number,
  filePath: string,
  state: 'completed' | 'failed' = 'completed'
): AgentJournalRenderItem {
  return {
    itemId: `write-${sequence}`,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: {
      kind: 'tool-call',
      name: 'Write',
      input: { file_path: filePath, content: 'x' },
      state
    }
  }
}

function diffItem(sequence: number, filePath: string): AgentJournalRenderItem {
  return {
    itemId: `diff-${sequence}`,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: {
      kind: 'diff',
      path: filePath,
      patch: { head: '', byteLength: 0, digest: 'd', truncated: false }
    }
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-recorded-file-rpc-'))
  record = { ...agentSessionRecordFixture(), sessionId: SESSION }
  items = []
  setStructuredAgentSessionHost(
    Object.assign(hostStub(), {
      deps: { store: { getRecord: (id: string) => (record?.sessionId === id ? record : null) } },
      journalSnapshot: vi.fn(async (sessionId: string) => ({
        sessionId,
        cursor: { epoch: 'epoch-a', sequence: items.length },
        items,
        submissions: []
      }))
    })
  )
})

afterEach(async () => {
  clearStructuredHostStub()
  await rm(root, { recursive: true, force: true })
})

async function recordedFile(name: string, content: string | Buffer): Promise<string> {
  const path = join(root, name)
  await writeFile(path, content)
  items.push(writeCall(items.length + 1, path))
  return path
}

describe('agentSession.readRecordedFile', () => {
  it('is registered and advertised, so a client can tell it from an older host', () => {
    expect(ALL_RPC_METHODS.map((method) => method.name)).toContain('agentSession.readRecordedFile')
    expect(RUNTIME_CAPABILITIES).toContain(AGENT_SESSION_RECORDED_FILE_READ_RUNTIME_CAPABILITY)
  })

  it('previews and stats a file the journal records the agent writing', async () => {
    const path = await recordedFile('report.html', '<h1>Report</h1>')
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      ok: true,
      result: { ok: true, mode: 'preview', content: '<h1>Report</h1>', isBinary: false }
    })
    expect(await call({ sessionId: SESSION, path, mode: 'stat' })).toMatchObject({
      ok: true,
      result: { ok: true, mode: 'stat', size: 15, isDirectory: false }
    })
  })

  it('serves a recorded image as base64', async () => {
    const path = await recordedFile('chart.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      ok: true,
      result: { ok: true, isBinary: true, isImage: true, mimeType: 'image/png' }
    })
  })

  it('also serves a path recorded as a diff item', async () => {
    const path = join(root, 'notes.md')
    await writeFile(path, '# Notes')
    items.push(diffItem(1, path))
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      result: { ok: true, content: '# Notes' }
    })
  })

  it('refuses a file the journal does not record, even though it exists', async () => {
    await recordedFile('report.html', 'ok')
    const other = join(root, 'secret.txt')
    await writeFile(other, 'secret')
    expect(await call({ sessionId: SESSION, path: other, mode: 'preview' })).toMatchObject({
      ok: true,
      result: { ok: false, error: 'not_recorded' }
    })
    expect(await call({ sessionId: SESSION, path: other, mode: 'stat' })).toMatchObject({
      result: { ok: false, error: 'not_recorded' }
    })
  })

  it('does not serve a failed write, a relative spelling, or a path with a parent segment', async () => {
    const failed = join(root, 'failed.txt')
    await writeFile(failed, 'x')
    items.push(writeCall(1, failed, 'failed'))
    // Built by hand: join() would fold the `..` away.
    const viaParent = `${root}${sep}sub${sep}..${sep}report.html`
    await mkdir(join(root, 'sub'))
    await recordedFile('report.html', 'ok')
    items.push(writeCall(9, 'report.html'), writeCall(10, viaParent))
    for (const path of [failed, 'report.html', viaParent]) {
      expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
        result: { ok: false, error: 'not_recorded' }
      })
    }
  })

  it('refuses an unknown session and a chat recorded on another execution host', async () => {
    const path = await recordedFile('report.html', 'ok')
    record = null
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      result: { ok: false, error: 'session_not_found' }
    })
    record = {
      ...agentSessionRecordFixture(),
      sessionId: SESSION,
      location: { ...agentSessionRecordFixture().location, executionHostId: 'ssh:box' }
    }
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      result: { ok: false, error: 'unsupported_location' }
    })
  })

  it('refuses a recorded directory and reports a recorded but deleted file as missing', async () => {
    const directory = join(root, 'out')
    await mkdir(directory)
    items.push(writeCall(1, directory), writeCall(2, join(root, 'gone.html')))
    expect(await call({ sessionId: SESSION, path: directory, mode: 'stat' })).toMatchObject({
      result: { ok: false, error: 'not_a_file' }
    })
    expect(
      await call({ sessionId: SESSION, path: join(root, 'gone.html'), mode: 'stat' })
    ).toMatchObject({ result: { ok: false, error: 'not_found' } })
  })

  it.skipIf(process.platform === 'win32')('refuses a recorded path that is a symlink', async () => {
    const target = join(root, 'target.txt')
    await writeFile(target, 'private')
    const link = join(root, 'link.txt')
    await symlink(target, link)
    items.push(writeCall(1, link))
    expect(await call({ sessionId: SESSION, path: link, mode: 'preview' })).toMatchObject({
      result: { ok: false, error: 'not_a_file' }
    })
  })

  it('refuses a file over the preview limit instead of truncating it', async () => {
    const path = await recordedFile('big.txt', 'a'.repeat(600 * 1024))
    expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
      result: { ok: false, error: 'too_large' }
    })
  })

  it('rejects params that name more than the session, path and mode', async () => {
    const response = await call({ sessionId: SESSION, path: '/x', mode: 'preview', extra: 1 })
    expect(response.ok).toBe(false)
  })
})
