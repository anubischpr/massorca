import { describe, expect, it } from 'vitest'
import type { PersistedUIState } from '../../../../../shared/persisted-ui-state-types'
import { createUIStore, makePersistedUI } from '../ui-slice-test-harness'

describe('marketplace host pick in the UI slice', () => {
  it('stores the picked host key and clears it back to this computer', () => {
    const store = createUIStore()
    expect(store.getState().marketplaceHostKey).toBeNull()

    store.getState().setMarketplaceHostKey('runtime:env-1')
    expect(store.getState().marketplaceHostKey).toBe('runtime:env-1')

    store.getState().setMarketplaceHostKey(null)
    expect(store.getState().marketplaceHostKey).toBeNull()
  })

  it('hydrates a persisted ssh, runtime or wsl host key', () => {
    const store = createUIStore()

    store.getState().hydratePersistedUI(makePersistedUI({ marketplaceHostKey: 'ssh:target-1' }))
    expect(store.getState().marketplaceHostKey).toBe('ssh:target-1')

    store.getState().hydratePersistedUI(makePersistedUI({ marketplaceHostKey: 'runtime:env-1' }))
    expect(store.getState().marketplaceHostKey).toBe('runtime:env-1')

    store.getState().hydratePersistedUI(makePersistedUI({ marketplaceHostKey: 'wsl:Ubuntu' }))
    expect(store.getState().marketplaceHostKey).toBe('wsl:Ubuntu')
  })

  it('sanitizes an invalid persisted host key to null', () => {
    const store = createUIStore()
    const invalidValues: unknown[] = ['bogus', 'runtime:', 'ssh:', 'wsl:', '', 42, { id: 'env-1' }]

    for (const value of invalidValues) {
      store
        .getState()
        .hydratePersistedUI(
          makePersistedUI({ marketplaceHostKey: value as PersistedUIState['marketplaceHostKey'] })
        )
      expect(store.getState().marketplaceHostKey).toBeNull()
    }
  })

  it('loads a state file written before the field existed as this computer', () => {
    const store = createUIStore()
    const legacy = makePersistedUI({ marketplaceHostKey: 'ssh:target-1' })
    delete legacy.marketplaceHostKey

    store.getState().hydratePersistedUI(legacy)

    expect(store.getState().marketplaceHostKey).toBeNull()
  })
})
