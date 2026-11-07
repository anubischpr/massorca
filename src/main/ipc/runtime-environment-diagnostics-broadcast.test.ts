import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRendererDiagnosticsSender,
  publishRuntimeEnvironmentDiagnostics,
  RUNTIME_ENVIRONMENT_DIAGNOSTICS_CHANNEL,
  setRuntimeEnvironmentDiagnosticsSender
} from './runtime-environment-diagnostics-broadcast'

const event = {
  environmentId: 'env-a',
  transportGeneration: 2,
  diagnostics: {
    state: 'reconnecting' as const,
    pendingRequestCount: 0,
    subscriptionCount: 1,
    reconnectAttempt: 1,
    lastConnectedAt: 1,
    lastClose: null,
    lastError: 'offline'
  }
}

describe('runtime environment diagnostics broadcast', () => {
  afterEach(() => setRuntimeEnvironmentDiagnosticsSender(() => undefined))

  it('publishes to live renderer windows and skips destroyed windows', () => {
    const live = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    const destroyed = { isDestroyed: () => true, webContents: { send: vi.fn() } }
    setRuntimeEnvironmentDiagnosticsSender(createRendererDiagnosticsSender(() => [live, destroyed]))

    publishRuntimeEnvironmentDiagnostics(event)

    expect(live.webContents.send).toHaveBeenCalledWith(
      RUNTIME_ENVIRONMENT_DIAGNOSTICS_CHANNEL,
      event
    )
    expect(destroyed.webContents.send).not.toHaveBeenCalled()
  })

  it('publishes nothing until a renderer sender is installed', () => {
    expect(() => publishRuntimeEnvironmentDiagnostics(event)).not.toThrow()
  })
})
