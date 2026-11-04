import { beforeEach, describe, expect, it, vi } from 'vitest'

const restore = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-prototype-client', () => {
  class PrototypeHostOutdatedError extends Error {}
  return { restorePrototypeVersionOnHost: restore, PrototypeHostOutdatedError }
})
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => ({ kind: 'local' })
}))

import { PrototypeHostOutdatedError } from '@/runtime/runtime-prototype-client'
import { restorePrototypeVersionAction } from './prototype-version-restore'

const SET = { sessionId: 'session-1', requestId: '20261028-201500-aaaaaa' }

describe('restorePrototypeVersionAction', () => {
  beforeEach(() => {
    restore.mockReset()
  })

  it('asks the host to copy the version into the next one, and reports the new version', async () => {
    restore.mockResolvedValue({ ok: true, fileName: 'prototypes/x/A-v4.html', version: 4 })
    await expect(restorePrototypeVersionAction(SET, 'A', 2)).resolves.toEqual({
      kind: 'restored',
      version: 4
    })
    expect(restore).toHaveBeenCalledWith(
      { kind: 'local' },
      { sessionId: 'session-1', requestId: SET.requestId, letter: 'A', version: 2 }
    )
  })

  it('reports a refused restore as failed, so the dialog can stay open for another try', async () => {
    restore.mockResolvedValue({ ok: false, error: 'conflict' })
    await expect(restorePrototypeVersionAction(SET, 'A', 2)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports an outdated host as unsupported', async () => {
    restore.mockRejectedValue(new PrototypeHostOutdatedError())
    await expect(restorePrototypeVersionAction(SET, 'A', 2)).resolves.toEqual({
      kind: 'unsupported'
    })
  })

  it('reports any other failure as failed', async () => {
    restore.mockRejectedValue(new Error('socket closed'))
    await expect(restorePrototypeVersionAction(SET, 'A', 2)).resolves.toEqual({ kind: 'failed' })
  })
})
