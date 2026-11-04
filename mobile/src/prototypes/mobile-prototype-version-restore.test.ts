import { describe, expect, it, vi } from 'vitest'
import type { RpcResponse } from '../transport/types'
import { listedSet } from './mobile-prototype-sets.test-fixture'
import {
  restoreFailureAlert,
  restoreMobilePrototypeVersionOf
} from './mobile-prototype-version-restore'

const ok = (result: unknown): RpcResponse => ({ ok: true, result, id: 'rpc-1' })

function answering(reply: RpcResponse | Error) {
  return {
    sendRequest: vi.fn((_method: string, _params: unknown, _options: unknown) =>
      reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)
    )
  }
}

describe('restoreMobilePrototypeVersionOf', () => {
  const set = listedSet()

  it('restores the chosen letter and earlier version of the set it was opened from', async () => {
    const client = answering(
      ok({ ok: true, fileName: `prototypes/${set.requestId}/B.v3.html`, version: 3 })
    )
    const outcome = await restoreMobilePrototypeVersionOf(client, set, 'B', 2)
    expect(client.sendRequest).toHaveBeenCalledWith(
      'prototypes.restoreVersion',
      { sessionId: set.sessionId, requestId: set.requestId, letter: 'B', version: 2 },
      expect.anything()
    )
    expect(outcome).toEqual({ kind: 'restored', version: 3 })
  })

  it('passes a refusal and an unsupported host through unchanged', async () => {
    expect(
      await restoreMobilePrototypeVersionOf(
        answering(ok({ ok: false, error: 'conflict' })),
        set,
        'A',
        1
      )
    ).toEqual({ kind: 'refused', error: 'conflict' })
    expect(
      await restoreMobilePrototypeVersionOf(
        answering({ ok: false, error: { code: 'method_not_found', message: 'nope' }, id: 'x' }),
        set,
        'A',
        1
      )
    ).toEqual({ kind: 'unsupported-host' })
  })
})

describe('restoreFailureAlert', () => {
  it('says what happened for each refusal, and nothing for a restore that worked', () => {
    expect(restoreFailureAlert({ kind: 'restored', version: 3 })).toBeNull()
    expect(restoreFailureAlert({ kind: 'refused', error: 'conflict' })?.title).toBe(
      'Could not restore this version'
    )
    expect(restoreFailureAlert({ kind: 'refused', error: 'not_found' })?.message).toMatch(
      /no longer/
    )
    expect(restoreFailureAlert({ kind: 'unreachable' })?.title).toBe(
      'Could not reach your computer'
    )
  })

  it('tells the user an older computer cannot restore, without offering a retry', () => {
    expect(restoreFailureAlert({ kind: 'unsupported-host' })?.message).toMatch(/Update Orca/)
  })
})
