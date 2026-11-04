import { beforeEach, describe, expect, it, vi } from 'vitest'

const restore = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-prototype-client', () => ({
  restoreDesignSystemVersionOnHost: restore
}))
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => ({ kind: 'local' })
}))

import { restoreDesignSystemVersionAction } from './prototype-design-system-restore'

describe('restoreDesignSystemVersionAction', () => {
  beforeEach(() => {
    restore.mockReset()
  })

  it('asks the host to copy the version into a new current one, and reports that version', async () => {
    restore.mockResolvedValue({ ok: true, version: 5 })
    await expect(restoreDesignSystemVersionAction('session-1', 3)).resolves.toEqual({
      kind: 'restored',
      version: 5
    })
    expect(restore).toHaveBeenCalledWith({ kind: 'local' }, { sessionId: 'session-1', version: 3 })
  })

  it('reports a refused restore as failed, so the dialog can stay open', async () => {
    restore.mockResolvedValue({ ok: false, error: 'unwritable' })
    await expect(restoreDesignSystemVersionAction('session-1', 3)).resolves.toEqual({
      kind: 'failed'
    })
  })

  it('reports a call that throws as failed', async () => {
    restore.mockRejectedValue(new Error('socket closed'))
    await expect(restoreDesignSystemVersionAction('session-1', 3)).resolves.toEqual({
      kind: 'failed'
    })
  })
})
