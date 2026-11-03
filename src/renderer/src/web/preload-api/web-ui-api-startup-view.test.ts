// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WebRuntimeSession from './web-runtime-session'

const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('./web-runtime-calls', () => ({ callRuntimeResult: mocks.call }))
vi.mock('./web-runtime-session', async (importOriginal) => ({
  ...(await importOriginal<typeof WebRuntimeSession>()),
  requireActiveEnvironmentOrNull: () => ({ id: 'env-1' })
}))

import { createWebUiApi } from './web-ui-api'

function setWithAck(updates: Record<string, unknown>): Promise<void> {
  const send = createWebUiApi().setWithAck
  if (!send) {
    throw new Error('setWithAck missing')
  }
  return send(updates)
}

/** An older host's ui.set refuses a view it predates. */
function hostWithoutCalendar(): void {
  mocks.call.mockImplementation(async (_method: string, updates: { activeView?: string }) => {
    if (updates.activeView === 'calendar') {
      throw new Error('Invalid enum value')
    }
    return {}
  })
}

describe('saving the startup view to an older host', () => {
  beforeEach(() => {
    mocks.call.mockReset()
    window.localStorage.clear()
  })

  it('keeps the rest of the update when the host refuses the view, without an error', async () => {
    hostWithoutCalendar()
    await expect(setWithAck({ activeView: 'calendar', sidebarWidth: 300 })).resolves.toBe(undefined)
    expect(mocks.call.mock.calls.map(([, updates]) => updates)).toEqual([
      { activeView: 'calendar', sidebarWidth: 300 },
      { sidebarWidth: 300 }
    ])
  })

  it('still reports a failure that has nothing to do with the view', async () => {
    mocks.call.mockRejectedValue(new Error('offline'))
    await expect(setWithAck({ sidebarWidth: 300 })).rejects.toThrow('offline')
    expect(mocks.call).toHaveBeenCalledTimes(1)
  })
})
