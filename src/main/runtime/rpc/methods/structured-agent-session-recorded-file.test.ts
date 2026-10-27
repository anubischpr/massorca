import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
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
import { recordedFileKeys } from '../../../native-chat/agent-session-recorded-file-read'
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

function toolCall(
  sequence: number,
  name: string,
  input: unknown,
  state: 'running' | 'completed' | 'failed' = 'completed'
): AgentJournalRenderItem {
  return {
    itemId: `call-${sequence}`,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: { kind: 'tool-call', name, input, state }
  }
}

function writeCall(
  sequence: number,
  filePath: string,
  state: 'running' | 'completed' | 'failed' = 'completed'
): AgentJournalRenderItem {
  return toolCall(sequence, 'Write', { file_path: filePath, content: 'x' }, state)
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

  describe('what counts as a write by the agent', () => {
    async function secretNeverServed(): Promise<string> {
      const secret = join(root, 'secret.txt')
      await writeFile(secret, 'secret')
      return secret
    }
    async function refused(path: string): Promise<void> {
      expect(await call({ sessionId: SESSION, path, mode: 'preview' })).toMatchObject({
        result: { ok: false, error: 'not_recorded' }
      })
    }

    it('ignores a path another tool merely carries in its input', async () => {
      const secret = await secretNeverServed()
      items.push(
        toolCall(1, 'mcp__x__search', {
          changes: [{ path: secret, diff: 'x', kind: { type: 'add' } }]
        }),
        toolCall(2, 'x/search', { changes: [{ path: secret, diff: 'x', kind: 'add' }] }),
        toolCall(3, 'Read', { file_path: secret }),
        toolCall(4, 'Grep', { path: secret }),
        toolCall(5, 'Diff', {
          patch: `--- a/x
+++ b/x
@@ -0,0 +1 @@
+x
`,
          path: secret
        })
      )
      await refused(secret)
    })

    it('does not let a write tool name files through a changes list', async () => {
      const secret = await secretNeverServed()
      const other = join(root, 'other.txt')
      await writeFile(other, 'other')
      items.push(
        toolCall(1, 'Write', {
          file_path: other,
          content: 'x',
          changes: [{ path: secret, diff: 'x', kind: 'add' }]
        })
      )
      await refused(secret)
      expect(await call({ sessionId: SESSION, path: other, mode: 'preview' })).toMatchObject({
        result: { ok: true, content: 'other' }
      })
    })

    it('serves the files a patch tool reports', async () => {
      const patched = join(root, 'patched.txt')
      await writeFile(patched, 'patched')
      items.push(
        toolCall(1, 'apply_patch', {
          changes: [{ path: patched, diff: 'patched', kind: { type: 'add' } }]
        })
      )
      expect(await call({ sessionId: SESSION, path: patched, mode: 'preview' })).toMatchObject({
        result: { ok: true, content: 'patched' }
      })
    })

    it('ignores a write that is still running or failed', async () => {
      const running = join(root, 'running.txt')
      const failed = join(root, 'failed.txt')
      await Promise.all([writeFile(running, 'r'), writeFile(failed, 'f')])
      items.push(writeCall(1, running, 'running'), writeCall(2, failed, 'failed'))
      await refused(running)
      await refused(failed)
    })

    it('ignores a path a user message mentions', async () => {
      const secret = await secretNeverServed()
      items.push({
        itemId: 'user-1',
        revision: 1,
        sequence: 1,
        observedAt: 1,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: `read ${secret}` }] }
      })
      await refused(secret)
    })
  })

  describe('which file is opened', () => {
    it('opens the recorded spelling for a client spelling that normalizes to it', async () => {
      const path = await recordedFile('résumé.txt'.normalize('NFC'), 'recorded')
      const variants = [
        path.normalize('NFD'),
        `${path}${sep}`,
        path.replace(`${sep}résumé`, `${sep}${sep}résumé`)
      ]
      for (const variant of variants) {
        expect(await call({ sessionId: SESSION, path: variant, mode: 'preview' })).toMatchObject({
          result: { ok: true, content: 'recorded' }
        })
      }
    })

    it('does not open a differently normalized file the client named', async () => {
      const nfc = join(root, 'café.txt'.normalize('NFC'))
      const nfd = join(root, 'café.txt'.normalize('NFD'))
      await writeFile(nfd, 'other file')
      // A filesystem that folds the two spellings has no second file to confuse.
      if (
        await readFile(nfc, 'utf8').then(
          () => true,
          () => false
        )
      ) {
        return
      }
      items.push(writeCall(1, nfc))
      expect(await call({ sessionId: SESSION, path: nfd, mode: 'preview' })).toMatchObject({
        result: { ok: false, error: 'not_found' }
      })
    })

    it.skipIf(process.platform === 'win32')('keeps case significant on a POSIX host', async () => {
      const path = await recordedFile('Report.html', 'ok')
      expect(
        await call({ sessionId: SESSION, path: path.replace('Report', 'report'), mode: 'stat' })
      ).toMatchObject({ result: { ok: false, error: 'not_recorded' } })
    })
  })

  it('never serves a UNC or device spelling', () => {
    expect(recordedFileKeys(['\\\\host\\share\\report.html', '\\\\.\\C:\\report.html']).size).toBe(
      0
    )
  })
})
