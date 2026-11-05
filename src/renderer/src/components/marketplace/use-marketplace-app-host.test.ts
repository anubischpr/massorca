// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  targets: [] as MarketplaceVaultHostTarget[],
  readHostApps: vi.fn()
}))

vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => mocks.targets
}))
vi.mock('./marketplace-apps-host-client', () => ({
  createHostMarketplaceAppsApi: () => ({}),
  readHostApps: mocks.readHostApps
}))

const { createTestStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { useMarketplaceAppHost } = await import('./use-marketplace-app-host')

const RUNTIME_TARGET: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-1',
  label: 'Build box'
}

let container: HTMLDivElement
let root: Root | null = null
let latest: MarketplaceAppHost | null = null

function Probe(): null {
  latest = useMarketplaceAppHost()
  return null
}

function mount(): void {
  act(() => root?.render(createElement(Probe)))
}

function mountFresh(): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mount()
}

function unmountFresh(): void {
  act(() => root?.unmount())
  root = null
  container.remove()
}

describe('useMarketplaceAppHost pick persistence', () => {
  beforeEach(() => {
    mocks.targets = [RUNTIME_TARGET]
    mocks.readHostApps.mockResolvedValue({ ok: true, apps: [] })
    store.getState().setMarketplaceHostKey(null)
  })

  afterEach(() => {
    if (root) {
      unmountFresh()
    }
    latest = null
  })

  it('keeps the picked host across an unmount and remount', () => {
    mountFresh()
    act(() => latest?.select('runtime:env-1'))
    expect(latest?.selectedKey).toBe('runtime:env-1')

    unmountFresh()
    mountFresh()

    expect(latest?.selectedKey).toBe('runtime:env-1')
    expect(latest?.scope?.label).toBe('Build box')
  })

  it('shows this computer while the saved host is unreachable and keeps the saved key', () => {
    store.getState().setMarketplaceHostKey('runtime:env-1')
    mocks.targets = []
    mountFresh()

    expect(latest?.selectedKey).toBeNull()
    expect(latest?.scope).toBeNull()
    expect(store.getState().marketplaceHostKey).toBe('runtime:env-1')

    mocks.targets = [RUNTIME_TARGET]
    mount()

    expect(latest?.selectedKey).toBe('runtime:env-1')
  })

  it('picking this computer clears the saved key', () => {
    mountFresh()
    act(() => latest?.select('runtime:env-1'))
    act(() => latest?.select(null))

    expect(latest?.selectedKey).toBeNull()
    expect(store.getState().marketplaceHostKey).toBeNull()
  })
})
