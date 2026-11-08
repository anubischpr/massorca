import { afterEach, describe, expect, it, vi } from 'vitest'
import { RUNTIME_HOST_STATUS_CHANNEL } from '../../shared/runtime-host-status'
import {
  createRendererHostStatusSender,
  publishRuntimeHostStatus,
  setRuntimeHostStatusSender
} from './runtime-environment-status-owner'

describe('runtime host status broadcast', () => {
  afterEach(() => setRuntimeHostStatusSender(() => undefined))

  it('publishes snapshots to live renderer windows and skips destroyed windows', () => {
    const live = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    const destroyed = { isDestroyed: () => true, webContents: { send: vi.fn() } }
    setRuntimeHostStatusSender(createRendererHostStatusSender(() => [live, destroyed]))
    const snapshot = { sequence: 7 } as never

    publishRuntimeHostStatus(snapshot)

    expect(live.webContents.send).toHaveBeenCalledWith(RUNTIME_HOST_STATUS_CHANNEL, snapshot)
    expect(destroyed.webContents.send).not.toHaveBeenCalled()
  })

  it('publishes nothing until a renderer sender is installed', () => {
    expect(() => publishRuntimeHostStatus({ sequence: 1 } as never)).not.toThrow()
  })
})
