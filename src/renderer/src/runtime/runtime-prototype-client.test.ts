import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callRuntimeRpc } from './runtime-rpc-client'
import {
  createPrototypeRequestOnHost,
  listPrototypeSetsOnHost,
  PrototypeHostOutdatedError,
  readDesignSystemOnHost,
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

  it('returns a create refusal for an unwritable folder as a value', async () => {
    callMock.mockResolvedValueOnce({ ok: false, error: 'unwritable' })

    expect(
      await createPrototypeRequestOnHost(LOCAL, {
        sessionId: 'session-alpha-0001',
        agent: 'claude',
        originalPrompt: 'a dashboard',
        count: 2
      })
    ).toEqual({ ok: false, error: 'unwritable' })
  })

  it('fails a list reply that is not the shape the host contract names', async () => {
    callMock.mockResolvedValueOnce({ sets: [{ requestId: 'no-folder-or-directions' }] })

    await expect(listPrototypeSetsOnHost(LOCAL, {})).rejects.toMatchObject({
      name: 'PrototypeHostMalformedReplyError'
    })
  })

  it('fails a read reply with an error the contract does not name, rather than reading it as a file', async () => {
    callMock.mockResolvedValueOnce({ ok: false, error: 'exploded' })

    await expect(
      readPrototypeSetFileOnHost(LOCAL, {
        sessionId: 'session-alpha-0001',
        requestId: '20261028-201500-aaaaaa',
        fileName: 'prototypes/20261028-201500-aaaaaa/A.html'
      })
    ).rejects.toMatchObject({ name: 'PrototypeHostMalformedReplyError' })
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

  it('reads the design system of a chat through the host that owns it', async () => {
    const reply = {
      ok: true,
      projectKey: 'abc123',
      projectName: 'nexuscare',
      fileNames: ['design/system/tokens.json'],
      tokensJson: '{}'
    }
    callMock.mockResolvedValueOnce(reply)

    expect(await readDesignSystemOnHost(LOCAL, { sessionId: 'session-alpha-0001' })).toEqual(reply)
    expect(callMock).toHaveBeenCalledWith(
      LOCAL,
      'prototypes.readDesignSystem',
      { sessionId: 'session-alpha-0001' },
      { timeoutMs: 15_000 }
    )
  })

  it('returns the refusal of a design system read as a value, and fails an unnamed shape', async () => {
    callMock.mockResolvedValueOnce({ ok: false, error: 'not_found' })
    expect(await readDesignSystemOnHost(LOCAL, { sessionId: 'session-alpha-0001' })).toEqual({
      ok: false,
      error: 'not_found'
    })
    callMock.mockResolvedValueOnce({ ok: true, projectKey: 'k' })
    await expect(
      readDesignSystemOnHost(LOCAL, { sessionId: 'session-alpha-0001' })
    ).rejects.toMatchObject({ name: 'PrototypeHostMalformedReplyError' })
  })

  it('reads a host without design systems as outdated', async () => {
    callMock.mockRejectedValueOnce(new Error('method_not_found'))
    await expect(
      readDesignSystemOnHost(LOCAL, { sessionId: 'session-alpha-0001' })
    ).rejects.toBeInstanceOf(PrototypeHostOutdatedError)
  })

  it('accepts the optional project fields and design systems of a list, and the lack of them', async () => {
    const withFields = {
      sets: [
        {
          requestId: '20261028-201500-aaaaaa',
          sessionId: 'session-alpha-0001',
          agent: 'claude',
          worktreeId: null,
          chatTitle: null,
          originalPrompt: 'x',
          createdAt: '2026-10-28T20:15:00.000Z',
          count: 1,
          projectKey: 'abc123',
          projectName: 'nexuscare',
          builtOn: 3,
          directions: []
        }
      ],
      designSystems: [
        {
          projectKey: 'abc123',
          projectName: 'nexuscare',
          status: 'detected',
          version: 3,
          tokenCount: 20,
          swatches: ['#2563eb']
        }
      ]
    }
    callMock.mockResolvedValueOnce(withFields)
    expect(await listPrototypeSetsOnHost(LOCAL, {})).toEqual(withFields)
    callMock.mockResolvedValueOnce({ sets: [] })
    expect(await listPrototypeSetsOnHost(LOCAL, {})).toEqual({ sets: [] })
  })

  it('fails a list whose design system has a status the contract does not name', async () => {
    callMock.mockResolvedValueOnce({
      sets: [],
      designSystems: [
        {
          projectKey: 'k',
          projectName: 'n',
          status: 'draft',
          version: 1,
          tokenCount: 0,
          swatches: []
        }
      ]
    })
    await expect(listPrototypeSetsOnHost(LOCAL, {})).rejects.toMatchObject({
      name: 'PrototypeHostMalformedReplyError'
    })
  })
})
