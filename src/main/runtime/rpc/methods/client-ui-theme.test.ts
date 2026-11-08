import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RpcRequest } from '../core'
import { RpcDispatcher } from '../dispatcher'
import { CLIENT_UI_METHODS } from './client-ui'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

function dispatcherWith(runtime: Record<string, unknown>): RpcDispatcher {
  return new RpcDispatcher({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the theme methods only call the runtime members each test supplies.
    runtime: { getRuntimeId: () => 'test-runtime', ...runtime } as unknown as OrcaRuntimeService,
    methods: CLIENT_UI_METHODS
  })
}

describe('appearance theme RPC methods', () => {
  it('reads the saved theme', async () => {
    const dispatcher = dispatcherWith({ getClientTheme: vi.fn(() => 'system') })
    expect(await dispatcher.dispatch(makeRequest('appearance.getTheme'))).toMatchObject({
      ok: true,
      result: { theme: 'system' }
    })
  })

  it('saves light, dark or system', async () => {
    const setClientTheme = vi.fn((theme: string) => theme)
    const dispatcher = dispatcherWith({ setClientTheme })
    expect(
      await dispatcher.dispatch(makeRequest('appearance.setTheme', { theme: 'dark' }))
    ).toMatchObject({ ok: true, result: { theme: 'dark' } })
    expect(setClientTheme).toHaveBeenCalledWith('dark')
  })

  it('rejects any other theme without saving', async () => {
    const setClientTheme = vi.fn()
    const dispatcher = dispatcherWith({ setClientTheme })
    expect(
      await dispatcher.dispatch(makeRequest('appearance.setTheme', { theme: 'blue' }))
    ).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(setClientTheme).not.toHaveBeenCalled()
  })
})
