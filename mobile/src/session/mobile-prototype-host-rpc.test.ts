import { describe, expect, it } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  createMobilePrototypeRequest,
  listMobilePrototypeSets,
  readMobilePrototypeFile
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
