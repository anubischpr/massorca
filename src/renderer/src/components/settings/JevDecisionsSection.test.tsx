// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { JevDecisionsStatus } from '../../../../shared/jev-decisions-status'
import { JevDecisionsSection } from './JevDecisionsSection'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: rpc }))

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

describe('JevDecisionsSection', () => {
  let root: Root | undefined

  afterEach(() => {
    act(() => root?.unmount())
    document.body.innerHTML = ''
  })

  async function render(
    enabled: boolean,
    apiKeyConfigured: boolean,
    apiKeyUnreadable = false
  ): Promise<HTMLElement> {
    Reflect.set(window, 'api', {
      jevDecisions: {
        getStatus: vi.fn(async () => ({
          apiKeyConfigured,
          apiKeyUnreadable,
          apiKeyProtection: apiKeyConfigured ? 'sealed' : null
        }))
      }
    })
    const host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <JevDecisionsSection
          target={{ kind: 'local' }}
          enabled={enabled}
          onEnabledChange={vi.fn()}
        />
      )
    })
    return host
  }

  function isSwitchDisabled(host: HTMLElement): boolean {
    return host.querySelector('[role="switch"]')?.hasAttribute('disabled') === true
  }

  it('is off by default', () => {
    expect(getDefaultSettings('/tmp').jevDecisionsEnabled).toBe(false)
  })

  it('cannot be turned on until a key is saved', async () => {
    expect(isSwitchDisabled(await render(false, false))).toBe(true)
  })

  it('can be turned on once a key is saved', async () => {
    expect(isSwitchDisabled(await render(false, true))).toBe(false)
  })

  it('says so and cannot be turned on when the saved key is unreadable', async () => {
    const host = await render(false, true, true)

    expect(isSwitchDisabled(host)).toBe(true)
    expect(host.textContent).toContain('cannot be read here')
    expect(host.textContent).not.toContain('saved on this computer')
  })

  it('warns while on when the saved key is unreadable', async () => {
    const host = await render(true, true, true)

    expect(isSwitchDisabled(host)).toBe(false)
    expect(host.textContent).toContain('cannot be read here')
  })

  describe('connected to a server', () => {
    const target = { kind: 'environment', environmentId: 'vps' } as const

    async function renderRemote(onEnabledChange = vi.fn()): Promise<HTMLElement> {
      const host = document.body.appendChild(document.createElement('div'))
      root = createRoot(host)
      await act(async () => {
        root?.render(
          <JevDecisionsSection target={target} enabled={false} onEnabledChange={onEnabledChange} />
        )
      })
      return host
    }

    function serverStatus(enabled: boolean): JevDecisionsStatus {
      return {
        apiKeyConfigured: true,
        apiKeyUnreadable: false,
        apiKeyProtection: 'plaintext',
        enabled
      }
    }

    it('reads the status from the server, never from this window', async () => {
      const localStatus = vi.fn()
      Reflect.set(window, 'api', { jevDecisions: { getStatus: localStatus } })
      rpc.mockResolvedValueOnce(serverStatus(true))

      const host = await renderRemote()

      expect(rpc).toHaveBeenCalledWith(target, 'jevDecisions.getStatus', undefined, {
        timeoutMs: 30_000
      })
      expect(localStatus).not.toHaveBeenCalled()
      expect(host.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true')
      expect(host.textContent).toContain('saved on the connected server')
    })

    it('turns the server switch on through the server, leaving the local setting alone', async () => {
      const onEnabledChange = vi.fn()
      rpc.mockResolvedValueOnce(serverStatus(false))
      const host = await renderRemote(onEnabledChange)
      rpc.mockResolvedValueOnce(serverStatus(true))

      await act(async () => {
        host.querySelector<HTMLElement>('[role="switch"]')?.click()
      })

      expect(rpc).toHaveBeenLastCalledWith(
        target,
        'jevDecisions.setEnabled',
        { enabled: true },
        { timeoutMs: 30_000 }
      )
      expect(onEnabledChange).not.toHaveBeenCalled()
    })

    it('ignores a late reply from a server the window has left', async () => {
      rpc.mockResolvedValueOnce(serverStatus(false))
      const host = await renderRemote()
      let finishOldRequest: (status: JevDecisionsStatus) => void = () => undefined
      rpc.mockReturnValueOnce(
        new Promise<JevDecisionsStatus>((resolve) => {
          finishOldRequest = resolve
        })
      )
      await act(async () => {
        host.querySelector<HTMLElement>('[role="switch"]')?.click()
      })

      rpc.mockResolvedValueOnce(serverStatus(false))
      await act(async () => {
        root?.render(
          <JevDecisionsSection
            target={{ kind: 'environment', environmentId: 'other' }}
            enabled={false}
            onEnabledChange={vi.fn()}
          />
        )
      })
      await act(async () => {
        finishOldRequest(serverStatus(true))
      })

      expect(host.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false')
      expect(host.querySelector('[role="switch"]')?.hasAttribute('disabled')).toBe(false)
    })

    it('warns about a key stored unencrypted on the server', async () => {
      rpc.mockResolvedValueOnce(serverStatus(true))

      const host = await renderRemote()

      expect(host.querySelector('[role="alert"]')).not.toBeNull()
    })

    it('says so when the server cannot report its status', async () => {
      rpc.mockRejectedValueOnce(new Error('method_not_found'))

      const host = await renderRemote()

      expect(host.textContent).toContain('update the server')
      expect(host.querySelector('[role="switch"]')?.hasAttribute('disabled')).toBe(true)
    })
  })

  it('can always be turned off', async () => {
    expect(isSwitchDisabled(await render(true, false))).toBe(false)
  })
})
