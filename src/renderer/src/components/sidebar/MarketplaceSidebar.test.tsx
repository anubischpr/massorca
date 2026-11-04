// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted((): { detected: string[] | null } => ({
  detected: []
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/local-preflight-context', () => ({
  getLocalPreflightContext: () => ({}),
  localPreflightContextKey: () => 'local'
}))
vi.mock('@/lib/agent-catalog', () => {
  const entries = [
    { id: 'claude', label: 'Claude Code' },
    { id: 'codex', label: 'Codex' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'opencode', label: 'OpenCode' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'copilot', label: 'Copilot' }
  ]
  const labelFor = (agent: string): string =>
    entries.find((entry) => entry.id === agent)?.label ?? agent
  return {
    AgentIcon: () => null,
    getAgentCatalog: () => entries,
    getAgentLabel: labelFor,
    getAgentDisplayLabel: labelFor
  }
})
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'unknown' }))
vi.mock('@/hooks/useDetectedAgents', () => ({
  useDetectedAgents: () => ({
    detectedIds: mocks.detected,
    isLoading: false,
    detectionFailed: false,
    isRefreshing: false,
    refresh: vi.fn()
  })
}))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => null
}))
vi.mock('@/runtime/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: vi.fn()
}))
vi.mock('../marketplace/MarketplaceCatalogSkills', () => ({
  useMarketplaceInstalledSkills: () => ({ status: 'loading' })
}))
vi.mock('./SidebarSearchRow', () => ({
  SidebarSearchRow: () => <button type="button">Search</button>
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceSidebar } = await import('./MarketplaceSidebar')

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceSidebar />
      </TooltipProvider>
    )
  })
  return container
}

// A row's label is its first flexible span; the count beside it is not part of the name.
const labelOf = (button: HTMLButtonElement): string =>
  (button.querySelector('span.flex-1') ?? button).textContent?.trim() ?? ''

const rowLabels = (container: ParentNode): string[] =>
  [...container.querySelectorAll('button')].map(labelOf)

function rowByLabel(container: ParentNode, label: string): HTMLButtonElement {
  const row = [...container.querySelectorAll('button')].find((button) => labelOf(button) === label)
  if (!row) {
    throw new Error(`Row ${label} missing`)
  }
  return row
}

async function clickRow(container: ParentNode, label: string): Promise<void> {
  const row = rowByLabel(container, label)
  await act(async () => {
    row.click()
  })
}

beforeEach(() => {
  mocks.detected = ['claude']
  seedStore(store, {
    activeView: 'marketplace',
    marketplaceSection: 'all',
    marketplaceSelectedItemId: null,
    marketplaceApps: {
      status: 'ready',
      apps: [
        { id: 'engram', connected: true, agents: [] },
        { id: 'openmetadata', connected: false, agents: [] }
      ]
    },
    preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: false } },
    preflightStatusChecked: true,
    preflightStatusContextKey: 'local'
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the Marketplace sidebar', () => {
  it('lists Search, the five tabs, then Your apps with the count and the installed apps', async () => {
    const container = await mount()
    expect(rowLabels(container)).toEqual([
      'Search',
      'All',
      'Tools',
      'Agents',
      'Skills',
      'Services',
      'All of them',
      'Git',
      'Engram',
      'Claude Code'
    ])
    expect(rowByLabel(container, 'All of them').textContent).toContain('3')
    expect(container.textContent).toContain('Your apps')
  })

  it('lists at most six apps under Your apps, while the count shows them all', async () => {
    mocks.detected = ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'copilot']
    const container = await mount()
    const labels = rowLabels(container)
    expect(labels.slice(labels.indexOf('All of them') + 1)).toEqual([
      'Git',
      'Engram',
      'Claude Code',
      'Codex',
      'Gemini',
      'OpenCode'
    ])
    expect(rowByLabel(container, 'All of them').textContent).toContain('8')
  })

  it('a section click picks that section and returns to the catalog', async () => {
    seedStore(store, { marketplaceSelectedItemId: 'engram' })
    const container = await mount()
    await clickRow(container, 'Tools')
    expect(store.getState().marketplaceSection).toBe('tools')
    expect(store.getState().marketplaceSelectedItemId).toBeNull()
  })

  it('All of them opens Your apps', async () => {
    const container = await mount()
    await clickRow(container, 'All of them')
    expect(store.getState().marketplaceSection).toBe('your-apps')
  })

  it('an app click opens that app page', async () => {
    const container = await mount()
    await clickRow(container, 'Engram')
    expect(store.getState().marketplaceSelectedItemId).toBe('engram')
  })

  it('an agent click opens the Agents section', async () => {
    const container = await mount()
    await clickRow(container, 'Claude Code')
    expect(store.getState().marketplaceSection).toBe('agents')
  })

  it('without the desktop bridge, Engram is not listed as installed', async () => {
    seedStore(store, { marketplaceApps: { status: 'unavailable' } })
    const container = await mount()
    expect(rowLabels(container)).toEqual([
      'Search',
      'All',
      'Tools',
      'Agents',
      'Skills',
      'Services',
      'All of them',
      'Git',
      'Claude Code'
    ])
  })
})
