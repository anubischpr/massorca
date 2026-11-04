// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { MarketplaceVaultHostStatus } from '../../../../shared/marketplace-apps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  sshStatus: vi.fn(),
  sshSet: vi.fn(),
  sshClear: vi.fn()
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { MarketplaceVaultHosts } = await import('./MarketplaceVaultHosts')
const { credentialSummary } = await import('./marketplace-vault-credential-text')

const TOKEN = 'tok-SECRET-123'
const NOW = 1_800_000_000_000

function status(stored: boolean): MarketplaceVaultHostStatus {
  return {
    hostLabel: 'srv2056164',
    store: 'key-file',
    credentials: [
      stored
        ? { slot: 'openmetadata', stored: true, updatedAt: NOW - 3 * 60_000 }
        : { slot: 'openmetadata', stored: false },
      { slot: 'engram-cloud', stored: false }
    ]
  }
}

const roots: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(<MarketplaceVaultHosts slot="openmetadata" />)
  })
  return container
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text
  )
}

function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  return act(async () => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function seedHosts(hosts: { runtime?: boolean; ssh?: boolean }): void {
  seedStore(store, {
    settings: {
      ...getDefaultSettings('/tmp'),
      activeRuntimeEnvironmentId: hosts.runtime ? 'env-1' : null
    },
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the vault list reads only id and name.
    runtimeEnvironments: hosts.runtime ? [{ id: 'env-1', name: 'srv2056164' } as never] : [],
    sshConnectionStates: new Map(
      hosts.ssh
        ? [['ssh-1', { targetId: 'ssh-1', status: 'connected', error: null, reconnectAttempt: 0 }]]
        : []
    ),
    sshTargetLabels: new Map(hosts.ssh ? [['ssh-1', 'build-box']] : [])
  })
}

describe('MarketplaceVaultHosts', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    Object.assign(window, {
      api: {
        marketplaceApps: {
          remoteVault: { status: mocks.sshStatus, set: mocks.sshSet, clear: mocks.sshClear }
        }
      }
    })
  })
  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  it('renders nothing when no other host is connected', async () => {
    seedHosts({})
    const container = await mount()
    expect(container.textContent).toBe('')
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })

  it('shows where the paired host keeps the token and never a value', async () => {
    seedHosts({ runtime: true })
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true, status: status(true) })
    const container = await mount()
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.vault.status',
      {},
      expect.anything()
    )
    expect(container.textContent).toContain('Stored encrypted on srv2056164')
    expect(container.textContent).toContain('Updated')
    expect(buttonWithText('Replace')).toBeDefined()
    expect(container.textContent).not.toContain(TOKEN)
  })

  it('tells the person to update a host that predates the vault', async () => {
    seedHosts({ runtime: true })
    mocks.callRuntimeRpc.mockRejectedValue(
      Object.assign(new Error('Unknown method'), { code: 'method_not_found' })
    )
    const container = await mount()
    expect(container.textContent).toContain('Update MassOrca on srv2056164 first.')
    expect(buttonWithText('Set token')).toBeUndefined()
    expect(buttonWithText('Replace')).toBeUndefined()
  })

  it('tells the person to update an SSH host whose relay lacks the methods', async () => {
    seedHosts({ ssh: true })
    mocks.sshStatus.mockResolvedValue({ ok: false, reason: 'host-needs-update' })
    const container = await mount()
    expect(container.textContent).toContain('Update MassOrca on build-box first.')
  })

  it('sets a token on an SSH host once, then shows only set and when', async () => {
    seedHosts({ ssh: true })
    mocks.sshStatus.mockResolvedValue({ ok: true, status: status(false) })
    mocks.sshSet.mockResolvedValue({ ok: true, status: status(true) })
    const container = await mount()
    expect(container.textContent).toContain('Not set on build-box')

    await act(async () => {
      buttonWithText('Set token')?.click()
    })
    const input = document.querySelector<HTMLInputElement>('input[type="password"]')
    if (!input) {
      throw new Error('Token input missing')
    }
    await typeInto(input, TOKEN)
    await act(async () => {
      document
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(mocks.sshSet).toHaveBeenCalledTimes(1)
    expect(mocks.sshSet).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      slot: 'openmetadata',
      token: TOKEN
    })
    expect(container.textContent).toContain('Stored encrypted on srv2056164')
    expect(document.body.textContent).not.toContain(TOKEN)
    expect(document.querySelector('input[type="password"]')).toBeNull()
  })

  it('sets a token on the paired host through the runtime RPC', async () => {
    seedHosts({ runtime: true })
    mocks.callRuntimeRpc.mockImplementation(async (_target, method: string) =>
      method === 'marketplace.vault.set'
        ? { ok: true, status: status(true) }
        : { ok: true, status: status(false) }
    )
    await mount()
    await act(async () => {
      buttonWithText('Set token')?.click()
    })
    await typeInto(document.querySelector<HTMLInputElement>('input[type="password"]')!, TOKEN)
    await act(async () => {
      document
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.vault.set',
      { slot: 'openmetadata', token: TOKEN },
      expect.anything()
    )
  })

  it('keeps the dialog open with a plain message when the host cannot be reached', async () => {
    seedHosts({ ssh: true })
    mocks.sshStatus.mockResolvedValue({ ok: true, status: status(false) })
    mocks.sshSet.mockResolvedValue({ ok: false, reason: 'unreachable' })
    await mount()
    await act(async () => {
      buttonWithText('Set token')?.click()
    })
    await typeInto(document.querySelector<HTMLInputElement>('input[type="password"]')!, TOKEN)
    await act(async () => {
      document
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(document.body.textContent).toContain('build-box is not reachable right now.')
    expect(document.body.textContent).not.toContain('Token stored')
  })
})

describe('credentialSummary', () => {
  it('names the host and the last change, never a value', () => {
    const summary = credentialSummary({
      updatedAt: Date.now() - 2 * 60_000,
      location: { hostLabel: 'srv2056164', store: 'key-file' }
    })
    expect(summary).toContain('Stored encrypted on srv2056164')
    expect(summary).toContain('Updated')
  })

  it('has nothing to say about a credential from a build without locations', () => {
    expect(credentialSummary({})).toBeNull()
  })
})
