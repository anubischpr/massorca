// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { MarketplaceInstalledSkills } from '../marketplace/MarketplaceCatalogSkills'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted((): { detected: string[] | null; skills: MarketplaceInstalledSkills } => ({
  detected: [],
  skills: { status: 'loading' }
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
  useMarketplaceInstalledSkills: () => mocks.skills
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

function installedSkill(name: string): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/home/dev/.agents/skills',
    directoryPath: `/home/dev/.agents/skills/${name}`,
    skillFilePath: `/home/dev/.agents/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null
  }
}

beforeEach(() => {
  mocks.detected = ['claude']
  mocks.skills = { status: 'loading' }
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
      'GitHub CLI',
      'Engram',
      'Claude Code'
    ])
    expect(rowByLabel(container, 'All of them').textContent).toContain('4')
    expect(container.textContent).toContain('Your apps')
  })

  it('lists only the board agents under Your apps, never other found agents', async () => {
    mocks.detected = ['claude', 'codex', 'gemini', 'opencode', 'cursor', 'copilot']
    const container = await mount()
    const labels = rowLabels(container)
    expect(labels.slice(labels.indexOf('All of them') + 1)).toEqual([
      'Git',
      'GitHub CLI',
      'Engram',
      'Claude Code',
      'Codex'
    ])
    expect(rowByLabel(container, 'All of them').textContent).toContain('5')
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

  it('a skill click opens the Skills section inside the Marketplace, not the Skills page', async () => {
    mocks.skills = { status: 'ready', skills: [installedSkill('alpha')] }
    const container = await mount()
    expect(rowLabels(container)).toContain('alpha')
    await clickRow(container, 'alpha')
    expect(store.getState().marketplaceSection).toBe('skills')
    expect(store.getState().activeView).toBe('marketplace')
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
      'GitHub CLI',
      'Claude Code'
    ])
  })
})
