// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSettingsNavigationMetadata } from '@/hooks/useSettingsNavigationMetadata'
import type { CatalogRow, CatalogSection } from '../marketplace/MarketplaceCatalogRows'
import { MarketplaceSettingsPane } from './MarketplaceSettingsPane'

const refreshApps = vi.hoisted(() => vi.fn())
let catalogSections: CatalogSection[] = []

vi.mock('@/i18n/i18n', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/i18n/i18n')),
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/store', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/store')),
  useAppStore: (selector: (state: { refreshMarketplaceApps: () => void }) => unknown) =>
    selector({ refreshMarketplaceApps: refreshApps })
}))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => null
}))
vi.mock('@/runtime/runtime-skills-client', () => ({ discoverSkillsForRuntimeTarget: vi.fn() }))
vi.mock('../marketplace/use-marketplace-app-host', () => ({
  useMarketplaceAppHost: () => ({ targets: [], selectedKey: null, apps: { status: 'unavailable' } })
}))
vi.mock('../marketplace/MarketplaceCatalogData', () => ({
  useMarketplaceCatalog: () => ({
    sections: catalogSections,
    badgeFor: () => undefined,
    installCustom: vi.fn()
  })
}))
vi.mock('../marketplace/MarketplaceAppPage', () => ({
  MarketplaceAppPage: ({ appId, onBack }: { appId: string; onBack: () => void }) => (
    <div data-testid="app-page">
      <span>{appId}</span>
      <button type="button" onClick={onBack}>
        Back to list
      </button>
    </div>
  )
}))
vi.mock('../marketplace/MarketplaceAgentPage', () => ({ MarketplaceAgentPage: () => null }))
vi.mock('../marketplace/MarketplaceDetail', () => ({ MarketplaceDetail: () => null }))
vi.mock('../marketplace/MarketplaceSkillPage', () => ({ MarketplaceSkillPage: () => null }))

const engramRow: CatalogRow = {
  key: 'tools-engram',
  section: 'tools',
  name: 'Engram',
  description: 'Memory for your agents.',
  icon: { kind: 'item', id: 'engram' },
  status: { kind: 'found', label: 'Found' },
  target: { kind: 'item', id: 'engram' },
  owned: true,
  service: false,
  customId: null
}

let mounted: { root: Root; container: HTMLDivElement } | null = null
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount())
    mounted.container.remove()
    mounted = null
  }
})

function renderPane(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted = { root, container }
  act(() => root.render(<MarketplaceSettingsPane />))
  return container
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text)
  )
  if (!found) {
    throw new Error(`no button containing "${text}"`)
  }
  return found
}

describe('MarketplaceSettingsPane', () => {
  it('lists one Marketplace section in the Settings navigation', () => {
    const sections = buildSettingsNavigationMetadata({
      isMac: false,
      isWindows: false,
      isWebClient: false,
      repos: []
    })
    expect(sections.filter((section) => section.id === 'marketplace').map((s) => s.title)).toEqual([
      'Marketplace'
    ])
  })

  it('opens a catalog row on its own detail page inside Settings, and Back returns to the catalog', () => {
    catalogSections = [
      {
        id: 'tools',
        name: 'Tools',
        note: 'Installed on each host',
        rows: [engramRow],
        placeholder: null
      }
    ]
    const container = renderPane()
    expect(container.querySelector('[data-testid="app-page"]')).toBeNull()

    act(() => findButton(container, 'Engram').click())
    expect(container.querySelector('[data-testid="app-page"]')?.textContent).toContain('engram')

    act(() => findButton(container, 'Back to list').click())
    expect(container.querySelector('[data-testid="app-page"]')).toBeNull()
    expect(container.querySelector('input[type="search"]')).not.toBeNull()
  })
})
