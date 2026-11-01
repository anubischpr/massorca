// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { JevDecisionsSection } from './JevDecisionsSection'

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
      jevDecisions: { getStatus: vi.fn(async () => ({ apiKeyConfigured, apiKeyUnreadable })) }
    })
    const host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
    await act(async () => {
      root?.render(<JevDecisionsSection enabled={enabled} onEnabledChange={vi.fn()} />)
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

  it('can always be turned off', async () => {
    expect(isSwitchDisabled(await render(true, false))).toBe(false)
  })
})
