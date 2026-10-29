import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callRuntimeRpc } from './runtime-rpc-client'
import {
  createPrototypeRequestOnHost,
  listPrototypeSetsOnHost,
  PrototypeHostOutdatedError,
  readPrototypeSetFileOnHost,
  writePrototypeAttachmentOnHost
} from './runtime-prototype-client'

vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc: vi.fn() }))

const callMock = vi.mocked(callRuntimeRpc)
const LOCAL = { kind: 'local' } as const

beforeEach(() => {
  callMock.mockReset()
})

describe('runtime prototype client', () => {
  it('writes a note screenshot through the host and returns its answer', async () => {
    callMock.mockResolvedValueOnce({ ok: true, path: '/state/notes/note-1.png' })

    expect(
      await writePrototypeAttachmentOnHost(LOCAL, {
        sessionId: 'session-alpha-0001',
        requestId: '20261028-201500-aaaaaa',
        name: 'note-1',
        pngBase64: 'iVBORw0KGgo='
      })
    ).toEqual({ ok: true, path: '/state/notes/note-1.png' })
    expect(callMock.mock.calls[0]?.[1]).toBe('prototypes.writeAttachment')
  })

  it('calls prototypes.list with the filter and a bounded timeout', async () => {
    callMock.mockResolvedValueOnce({ sets: [] })

    expect(await listPrototypeSetsOnHost(LOCAL, { worktreeId: 'wt-1' })).toEqual({ sets: [] })
    expect(callMock).toHaveBeenCalledWith(
      LOCAL,
      'prototypes.list',
      { worktreeId: 'wt-1' },
      { timeoutMs: 15_000 }
    )
  })

  it('returns the typed create answer of the host unchanged', async () => {
    callMock.mockResolvedValueOnce({ ok: false, error: 'unsupported' })

    expect(
      await createPrototypeRequestOnHost(LOCAL, {
        sessionId: 'session-alpha-0001',
        agent: 'claude',
        originalPrompt: 'a dashboard',
        count: 2
      })
    ).toEqual({ ok: false, error: 'unsupported' })
    expect(callMock.mock.calls[0]?.[1]).toBe('prototypes.createRequest')
  })

  it('returns the refusal of a set file as a value', async () => {
    callMock.mockResolvedValueOnce({ ok: false, error: 'too_large' })

    expect(
      await readPrototypeSetFileOnHost(LOCAL, {
        sessionId: 'session-alpha-0001',
        requestId: '20261028-201500-aaaaaa',
        fileName: 'prototypes/20261028-201500-aaaaaa/A.html'
      })
    ).toEqual({ ok: false, error: 'too_large' })
  })

  it('reads a host that predates prototypes as outdated, not as a failure of the file', async () => {
    callMock.mockRejectedValueOnce(new Error('method_not_found'))

    await expect(listPrototypeSetsOnHost(LOCAL, {})).rejects.toBeInstanceOf(
      PrototypeHostOutdatedError
    )
  })

  it('reads a host that does not serve structured chats the same way', async () => {
    callMock.mockRejectedValueOnce(new Error('structured_agent_session_unsupported'))

    await expect(listPrototypeSetsOnHost(LOCAL, {})).rejects.toBeInstanceOf(
      PrototypeHostOutdatedError
    )
  })

  it('passes any other failure through unchanged', async () => {
    const transport = new Error('connection lost')
    callMock.mockRejectedValueOnce(transport)

    await expect(listPrototypeSetsOnHost(LOCAL, {})).rejects.toBe(transport)
  })
})
