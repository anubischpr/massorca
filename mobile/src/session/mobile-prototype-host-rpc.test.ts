import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  createMobilePrototypeRequest,
  listMobilePrototypeSets,
  readMobilePrototypeFile,
  writeMobilePrototypeAttachment
} from './mobile-prototype-host-rpc'

const SESSION = 'session-alpha-0001'
const REQUEST = '20261028-201500-aaaaaa'

function clientAnswering(response: RpcResponse | Error): Pick<RpcClient, 'sendRequest'> {
  return {
    sendRequest: () =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  }
}

const ok = (result: unknown): RpcResponse => ({ ok: true, result, id: 'rpc-1' })
const failed = (code: string, message = 'nope'): RpcResponse => ({
  ok: false,
  error: { code, message },
  id: 'rpc-1'
})

const validSet = {
  requestId: REQUEST,
  sessionId: SESSION,
  agent: 'claude',
  worktreeId: 'wt-1',
  chatTitle: null,
  originalPrompt: 'a dashboard',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 2,
  directions: [
    {
      letter: 'A',
      versions: [{ version: 1, fileName: `prototypes/${REQUEST}/A.html`, mtime: 1 }]
    }
  ]
}

describe('createMobilePrototypeRequest', () => {
  it('reads the request folder the host made', async () => {
    const client = clientAnswering(
      ok({ ok: true, requestId: REQUEST, folderPath: '/state/prototypes/x' })
    )
    expect(
      await createMobilePrototypeRequest(client, {
        sessionId: SESSION,
        agent: 'claude',
        originalPrompt: 'a dashboard',
        count: 2
      })
    ).toEqual({ kind: 'ready', requestId: REQUEST, folderPath: '/state/prototypes/x' })
  })

  it('reads the host saying the chat has no visuals folder as unsupported', async () => {
    const client = clientAnswering(ok({ ok: false, error: 'unsupported' }))
    expect(
      await createMobilePrototypeRequest(client, {
        sessionId: SESSION,
        agent: 'claude',
        originalPrompt: 'x',
        count: 1
      })
    ).toEqual({ kind: 'unsupported' })
  })

  it('reads a folder the host could not write as unwritable, apart from unsupported', async () => {
    const params = { sessionId: SESSION, agent: 'claude' as const, originalPrompt: 'x', count: 1 }
    expect(
      await createMobilePrototypeRequest(
        clientAnswering(ok({ ok: false, error: 'unwritable' })),
        params
      )
    ).toEqual({ kind: 'unwritable' })
  })

  it('reads an older host as unsupported-host, and a dropped reply as unreachable', async () => {
    const params = { sessionId: SESSION, agent: 'claude' as const, originalPrompt: 'x', count: 1 }
    expect(
      await createMobilePrototypeRequest(clientAnswering(failed('method_not_found')), params)
    ).toEqual({ kind: 'unsupported-host' })
    expect(await createMobilePrototypeRequest(clientAnswering(new Error('drop')), params)).toEqual({
      kind: 'unreachable'
    })
  })
})

describe('listMobilePrototypeSets', () => {
  it('reads the sets with their directions', async () => {
    const client = clientAnswering(ok({ sets: [validSet] }))
    expect(await listMobilePrototypeSets(client, { worktreeId: 'wt-1' })).toEqual({
      kind: 'ready',
      sets: [validSet]
    })
  })

  it('reads a reply that does not parse as unreachable, not as an empty list', async () => {
    const client = clientAnswering(ok({ sets: [{ requestId: 42 }] }))
    expect(await listMobilePrototypeSets(client, {})).toEqual({ kind: 'unreachable' })
  })

  it('reads a host that does not serve structured chats as unsupported-host', async () => {
    const client = clientAnswering(failed('structured_agent_session_unsupported'))
    expect(await listMobilePrototypeSets(client, {})).toEqual({ kind: 'unsupported-host' })
  })
})

describe('readMobilePrototypeFile', () => {
  it('reads the HTML of a set file', async () => {
    const client = clientAnswering(ok({ ok: true, html: '<p>a</p>' }))
    expect(
      await readMobilePrototypeFile(client, {
        sessionId: SESSION,
        requestId: REQUEST,
        fileName: `prototypes/${REQUEST}/A.html`
      })
    ).toEqual({ kind: 'ready', html: '<p>a</p>' })
  })

  it('reads the host refusal of the file as a refusal of that file', async () => {
    const client = clientAnswering(ok({ ok: false, error: 'too_large' }))
    expect(
      await readMobilePrototypeFile(client, {
        sessionId: SESSION,
        requestId: REQUEST,
        fileName: `prototypes/${REQUEST}/A.html`
      })
    ).toEqual({ kind: 'refused', error: 'too_large' })
  })

  it('reads a refusal the host did not name as no verdict', async () => {
    const client = clientAnswering(ok({ ok: false, error: 'a_new_reason' }))
    expect(
      await readMobilePrototypeFile(client, {
        sessionId: SESSION,
        requestId: REQUEST,
        fileName: `prototypes/${REQUEST}/A.html`
      })
    ).toEqual({ kind: 'unreachable' })
  })
})

describe('writeMobilePrototypeAttachment', () => {
  const params = {
    sessionId: SESSION,
    requestId: REQUEST,
    name: 'pin-abc-42',
    pngBase64: 'iVBORw0KGgo='
  }

  it('sends the screenshot to the host and reads back the path it saved it at', async () => {
    const sendRequest = vi.fn<Pick<RpcClient, 'sendRequest'>['sendRequest']>(async () =>
      ok({ ok: true, path: '/state/prototypes/x/notes/pin-abc-42.png' })
    )
    expect(await writeMobilePrototypeAttachment({ sendRequest }, params)).toEqual({
      kind: 'ready',
      path: '/state/prototypes/x/notes/pin-abc-42.png'
    })
    expect(sendRequest.mock.calls[0]?.[0]).toBe('prototypes.writeAttachment')
    expect(sendRequest.mock.calls[0]?.[1]).toEqual(params)
  })

  it('reads the host refusing the screenshot as a refusal of that file', async () => {
    const client = clientAnswering(ok({ ok: false, error: 'too_large' }))
    expect(await writeMobilePrototypeAttachment(client, params)).toEqual({
      kind: 'refused',
      error: 'too_large'
    })
  })

  it('reads an older host as unsupported', async () => {
    const client = clientAnswering(failed('method_not_found'))
    expect(await writeMobilePrototypeAttachment(client, params)).toEqual({
      kind: 'unsupported-host'
    })
  })

  it('reads a lost connection or a reply it cannot read as no verdict', async () => {
    expect(
      await writeMobilePrototypeAttachment(clientAnswering(new Error('offline')), params)
    ).toEqual({
      kind: 'unreachable'
    })
    expect(await writeMobilePrototypeAttachment(clientAnswering(ok({ ok: true })), params)).toEqual(
      { kind: 'unreachable' }
    )
  })
})
