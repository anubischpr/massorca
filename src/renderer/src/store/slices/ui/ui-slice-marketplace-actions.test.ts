// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppStatus } from '../../../../../shared/marketplace-apps'

const { createTestStore, seedStore } = await import('../store-test-helpers')

const engram: MarketplaceAppStatus = { id: 'engram', connected: true, agents: [] }

describe('Marketplace state in the UI slice', () => {
  beforeEach(() => {
    // Why: the web client has no marketplace bridge; the apps must read as unavailable.
    Object.assign(window, { api: undefined })
  })

  it('opens the catalog when Marketplace is entered from another view', () => {
    const store = createTestStore()
    seedStore(store, { activeView: 'terminal', marketplaceSelectedItemId: 'engram' })

    store.getState().openMarketplacePage()

    expect(store.getState().marketplaceSelectedItemId).toBeNull()
  })

  it('keeps the open app page when Marketplace is opened again on its own view', () => {
    const store = createTestStore()
    seedStore(store, { activeView: 'marketplace', marketplaceSelectedItemId: 'engram' })

    store.getState().openMarketplacePage()

    expect(store.getState().marketplaceSelectedItemId).toBe('engram')
  })

  it('stores the chosen section and catalog item', () => {
    const store = createTestStore()

    store.getState().setMarketplaceSection('services')
    store.getState().selectMarketplaceItem('github')

    expect(store.getState().marketplaceSection).toBe('services')
    expect(store.getState().marketplaceSelectedItemId).toBe('github')
  })

  it('opens the catalog on one section from another page', () => {
    const store = createTestStore()
    store.getState().selectMarketplaceItem('engram')

    store.getState().openMarketplaceSection('services')

    expect(store.getState().activeView).toBe('marketplace')
    expect(store.getState().marketplaceSection).toBe('services')
    expect(store.getState().marketplaceSelectedItemId).toBeNull()
  })

  it('reads the apps as unavailable without the desktop bridge', async () => {
    const store = createTestStore()

    await store.getState().refreshMarketplaceApps()

    expect(store.getState().marketplaceApps).toEqual({ status: 'unavailable' })
  })

  it('stores the apps the bridge lists', async () => {
    const store = createTestStore()
    Object.assign(window, { api: { marketplaceApps: { listApps: vi.fn(async () => [engram]) } } })

    await store.getState().refreshMarketplaceApps()

    expect(store.getState().marketplaceApps).toEqual({ status: 'ready', apps: [engram] })
  })

  it('reports failed when listing the apps throws', async () => {
    const store = createTestStore()
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: vi.fn(async () => {
            throw new Error('bridge down')
          })
        }
      }
    })

    await store.getState().refreshMarketplaceApps()

    expect(store.getState().marketplaceApps).toEqual({ status: 'failed' })
  })
})
