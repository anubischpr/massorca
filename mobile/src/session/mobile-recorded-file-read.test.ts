import { describe, expect, it } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  isRecordedFileMethodUnavailable,
  readMobileRecordedFile,
  recordedFileReadFromReply
} from './mobile-recorded-file-read'

describe('recordedFileReadFromReply', () => {
  it('reads a text preview as ready content', () => {
    expect(
      recordedFileReadFromReply({
        ok: true,
        mode: 'preview',
        content: '<h1>Hi</h1>',
        isBinary: false
      })
    ).toEqual({ kind: 'ready', content: '<h1>Hi</h1>' })
  })

  it('reads a binary preview as binary, whatever its content', () => {
    expect(
      recordedFileReadFromReply({ ok: true, mode: 'preview', content: '', isBinary: true })
    ).toEqual({ kind: 'binary' })
  })

  it('reads each host refusal as that refusal', () => {
    expect(recordedFileReadFromReply({ ok: false, error: 'not_recorded' })).toEqual({
      kind: 'refused',
      reason: 'not_recorded'
    })
    expect(recordedFileReadFromReply({ ok: false, error: 'too_large' })).toEqual({
      kind: 'refused',
      reason: 'too_large'
    })
  })

  it('reads an unknown refusal or a malformed reply as no verdict', () => {
    expect(recordedFileReadFromReply({ ok: false, error: 'a_new_reason' })).toEqual({
      kind: 'unreachable'
    })
    expect(recordedFileReadFromReply({ ok: true, mode: 'stat', size: 1 })).toEqual({
      kind: 'unreachable'
    })
    expect(recordedFileReadFromReply(null)).toEqual({ kind: 'unreachable' })
  })
})

describe('isRecordedFileMethodUnavailable', () => {
  it('reads an absent method, a mobile-forbidden method and an unsupported chat as an older host', () => {
    expect(isRecordedFileMethodUnavailable('method_not_found', '')).toBe(true)
    expect(isRecordedFileMethodUnavailable('forbidden', '')).toBe(true)
    expect(isRecordedFileMethodUnavailable('structured_agent_session_unsupported', '')).toBe(true)
  })

  it('does not read a transient failure as an older host', () => {
    expect(isRecordedFileMethodUnavailable('internal_error', 'boom')).toBe(false)
  })
})

function clientAnswering(response: RpcResponse | Error): {
  client: RpcClient
  calls: unknown[][]
} {
  const calls: unknown[][] = []
  const client = {
    sendRequest: (...args: unknown[]) => {
      calls.push(args)
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
    }
  } as unknown as RpcClient
  return { client, calls }
}

describe('readMobileRecordedFile', () => {
  const source = (client: RpcClient) => ({ client, sessionId: 'session-1' })

  it('asks the host for a preview of the path under the chat session', async () => {
    const { client, calls } = clientAnswering({
      id: '1',
      ok: true,
      result: { ok: true, mode: 'preview', content: 'x', isBinary: false }
    })
    await expect(readMobileRecordedFile(source(client), 'site/index.html')).resolves.toEqual({
      kind: 'ready',
      content: 'x'
    })
    expect(calls[0]?.[0]).toBe('agentSession.readRecordedFile')
    expect(calls[0]?.[1]).toEqual({
      sessionId: 'session-1',
      path: 'site/index.html',
      mode: 'preview'
    })
  })

  it('reads an older host as unavailable, so the viewer does not retry', async () => {
    const { client } = clientAnswering({
      id: '1',
      ok: false,
      error: { code: 'method_not_found', message: 'unknown method' }
    })
    await expect(readMobileRecordedFile(source(client), 'a.html')).resolves.toEqual({
      kind: 'unavailable'
    })
  })

  it('reads a refused call without a verdict as unreachable, and a thrown one likewise', async () => {
    const failed = clientAnswering({
      id: '1',
      ok: false,
      error: { code: 'internal_error', message: 'boom' }
    })
    await expect(readMobileRecordedFile(source(failed.client), 'a.html')).resolves.toEqual({
      kind: 'unreachable'
    })
    const thrown = clientAnswering(new Error('connection dropped'))
    await expect(readMobileRecordedFile(source(thrown.client), 'a.html')).resolves.toEqual({
      kind: 'unreachable'
    })
  })
})
