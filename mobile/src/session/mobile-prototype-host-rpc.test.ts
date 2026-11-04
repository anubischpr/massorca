import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  archiveMobilePrototypeRequest,
  createMobilePrototypeRequest,
  deleteMobilePrototypeRequest,
  hostListsDesignSystems,
  hostMayArchivePrototypes,
  hostMayRestorePrototypeVersions,
  listMobilePrototypeSets,
  readMobilePrototypeDesignSystem,
  readMobilePrototypeFile,
  restoreMobilePrototypeVersion,
  unarchiveMobilePrototypeRequest,
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

describe('readMobilePrototypeDesignSystem', () => {
  it('reads the files of the project of a chat', async () => {
    const files = {
      projectKey: 'abc123',
      projectName: 'nexuscare',
      fileNames: ['design/system/tokens.json'],
      tokensJson: '{}'
    }
    expect(
      await readMobilePrototypeDesignSystem(clientAnswering(ok({ ok: true, ...files })), {
        sessionId: SESSION
      })
    ).toEqual({ kind: 'ready', ...files })
  })

  it('reads the host saying it has no such local chat as refused', async () => {
    expect(
      await readMobilePrototypeDesignSystem(
        clientAnswering(ok({ ok: false, error: 'not_found' })),
        { sessionId: SESSION }
      )
    ).toEqual({ kind: 'refused' })
  })

  it('reads an older host as unsupported and a lost transport or malformed reply as unreachable', async () => {
    const params = { sessionId: SESSION }
    expect(
      await readMobilePrototypeDesignSystem(clientAnswering(failed('method_not_found')), params)
    ).toEqual({ kind: 'unsupported-host' })
    expect(
      await readMobilePrototypeDesignSystem(clientAnswering(new Error('offline')), params)
    ).toEqual({ kind: 'unreachable' })
    expect(
      await readMobilePrototypeDesignSystem(clientAnswering(ok({ ok: true })), params)
    ).toEqual({ kind: 'unreachable' })
  })
})

describe('listMobilePrototypeSets design systems', () => {
  it('passes the design systems of the host through, and omits them for an older host', async () => {
    const designSystems = [
      {
        projectKey: 'abc123',
        projectName: 'nexuscare',
        status: 'proposed',
        version: 1,
        tokenCount: 12,
        agent: 'Codex',
        swatches: ['#2563eb', '#eee']
      }
    ]
    expect(
      await listMobilePrototypeSets(
        clientAnswering(
          ok({ sets: [{ ...validSet, projectKey: 'abc123', builtOn: 2 }], designSystems })
        ),
        {}
      )
    ).toEqual({
      kind: 'ready',
      sets: [{ ...validSet, projectKey: 'abc123', builtOn: 2 }],
      designSystems
    })
    expect(await listMobilePrototypeSets(clientAnswering(ok({ sets: [validSet] })), {})).toEqual({
      kind: 'ready',
      sets: [validSet]
    })
  })
})

describe('hostListsDesignSystems', () => {
  const withSystems = ok({ sets: [validSet], designSystems: [] })

  it('is false before any listing, true after a reply that carries designSystems, even empty', async () => {
    const client = clientAnswering(withSystems)
    expect(hostListsDesignSystems(client)).toBe(false)
    await listMobilePrototypeSets(client, {})
    expect(hostListsDesignSystems(client)).toBe(true)
  })

  it('is false after a reply without designSystems, which an older host sends', async () => {
    const client = clientAnswering(ok({ sets: [validSet] }))
    await listMobilePrototypeSets(client, {})
    expect(hostListsDesignSystems(client)).toBe(false)
  })

  it('follows the last reply, and a failed listing leaves it as it was', async () => {
    let reply: RpcResponse | Error = withSystems
    const client: Pick<RpcClient, 'sendRequest'> = {
      sendRequest: () => (reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply))
    }
    await listMobilePrototypeSets(client, {})
    reply = new Error('offline')
    await listMobilePrototypeSets(client, {})
    expect(hostListsDesignSystems(client)).toBe(true)
    reply = ok({ sets: [validSet] })
    await listMobilePrototypeSets(client, {})
    expect(hostListsDesignSystems(client)).toBe(false)
  })

  it('does not carry the answer of one host to another', async () => {
    await listMobilePrototypeSets(clientAnswering(withSystems), {})
    expect(hostListsDesignSystems(clientAnswering(withSystems))).toBe(false)
  })
})

describe('archive, unarchive and delete of a set', () => {
  const target = { sessionId: SESSION, requestId: REQUEST }

  it('sends the method of each action with the session and request alone', async () => {
    const sendRequest = vi.fn((_method: string, _params: unknown) =>
      Promise.resolve(ok({ ok: true }))
    )
    const client = { sendRequest }
    expect(await archiveMobilePrototypeRequest(client, target)).toEqual({ kind: 'done' })
    expect(await unarchiveMobilePrototypeRequest(client, target)).toEqual({ kind: 'done' })
    expect(await deleteMobilePrototypeRequest(client, target)).toEqual({ kind: 'done' })
    expect(sendRequest.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ['prototypes.archive', target],
      ['prototypes.unarchive', target],
      ['prototypes.delete', target]
    ])
  })

  it('reads the host refusals as verdicts', async () => {
    expect(
      await deleteMobilePrototypeRequest(
        clientAnswering(ok({ ok: false, error: 'not_deletable' })),
        target
      )
    ).toEqual({ kind: 'refused', error: 'not_deletable' })
    expect(
      await archiveMobilePrototypeRequest(
        clientAnswering(ok({ ok: false, error: 'not_found' })),
        target
      )
    ).toEqual({ kind: 'refused', error: 'not_found' })
  })

  it('refuses a delete answer that an archive could not give, and a lost transport, as unreachable', async () => {
    expect(
      await archiveMobilePrototypeRequest(
        clientAnswering(ok({ ok: false, error: 'not_deletable' })),
        target
      )
    ).toEqual({ kind: 'unreachable' })
    expect(
      await deleteMobilePrototypeRequest(clientAnswering(new Error('socket closed')), target)
    ).toEqual({ kind: 'unreachable' })
    expect(
      await deleteMobilePrototypeRequest(clientAnswering(failed('internal_error')), target)
    ).toEqual({ kind: 'unreachable' })
  })

  it('reads an older host as unsupported, and remembers it for that host alone', async () => {
    const older = clientAnswering(failed('forbidden', 'method not allowed'))
    const current = clientAnswering(ok({ ok: true }))
    expect(hostMayArchivePrototypes(older)).toBe(true)
    expect(await archiveMobilePrototypeRequest(older, target)).toEqual({ kind: 'unsupported-host' })
    expect(hostMayArchivePrototypes(older)).toBe(false)
    expect(hostMayArchivePrototypes(current)).toBe(true)
  })
})

describe('restoreMobilePrototypeVersion', () => {
  const params = { sessionId: SESSION, requestId: REQUEST, letter: 'B', version: 2 }
  const restoredFile = `prototypes/${REQUEST}/B.v3.html`

  function recordingClient(reply: RpcResponse | Error) {
    return {
      sendRequest: vi.fn((_method: string, _params: unknown, _options: unknown) =>
        reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
      )
    }
  }

  it('asks the host to restore one earlier version and reads the new current file', async () => {
    const client = recordingClient(ok({ ok: true, fileName: restoredFile, version: 3 }))
    expect(await restoreMobilePrototypeVersion(client, params)).toEqual({
      kind: 'restored',
      fileName: restoredFile,
      version: 3
    })
    expect(client.sendRequest).toHaveBeenCalledWith(
      'prototypes.restoreVersion',
      params,
      expect.anything()
    )
  })

  it('reads each refusal the host gives as that verdict', async () => {
    for (const error of ['not_found', 'conflict', 'unwritable']) {
      expect(
        await restoreMobilePrototypeVersion(clientAnswering(ok({ ok: false, error })), params)
      ).toEqual({ kind: 'refused', error })
    }
  })

  it('reads an answer that is not a restore reply as unreachable', async () => {
    expect(
      await restoreMobilePrototypeVersion(clientAnswering(ok({ ok: true, version: 1 })), params)
    ).toEqual({ kind: 'unreachable' })
  })

  it('reads a dropped reply and an internal error as unreachable', async () => {
    expect(
      await restoreMobilePrototypeVersion(clientAnswering(new Error('socket closed')), params)
    ).toEqual({ kind: 'unreachable' })
    expect(
      await restoreMobilePrototypeVersion(clientAnswering(failed('internal_error')), params)
    ).toEqual({ kind: 'unreachable' })
  })

  it('reads an older host as unsupported-host, and remembers it for that host alone', async () => {
    const older = clientAnswering(failed('method_not_found'))
    const current = clientAnswering(ok({ ok: true, fileName: restoredFile, version: 3 }))
    expect(hostMayRestorePrototypeVersions(older)).toBe(true)
    expect(await restoreMobilePrototypeVersion(older, params)).toEqual({
      kind: 'unsupported-host'
    })
    expect(hostMayRestorePrototypeVersions(older)).toBe(false)
    expect(hostMayRestorePrototypeVersions(current)).toBe(true)
  })
})
