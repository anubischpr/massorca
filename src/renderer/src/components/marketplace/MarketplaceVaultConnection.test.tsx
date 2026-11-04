// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TOKEN = 'tok-SECRET-123'

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
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => agent
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAppPage } = await import('./MarketplaceAppPage')

const agents: MarketplaceAppStatus['agents'] = [
  { agent: 'claude', level: 'full', entry: 'set' },
  { agent: 'codex', level: 'full', entry: 'set' },
  { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
  { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
]

function openMetadata(credential: MarketplaceAppStatus['credential']): MarketplaceAppStatus {
  return {
    id: 'openmetadata',
    connected: true,
    serverUrl: 'https://metadata.example.com',
    credential,
    profiles: [],
    agents
  }
}

const roots: { container: HTMLDivElement; root: Root }[] = []

async function mountWith(status: MarketplaceAppStatus): Promise<HTMLDivElement> {
  seedStore(store, {
    activeView: 'marketplace',
    marketplaceApps: { status: 'ready', apps: [status] },
    preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: true } },
    preflightStatusChecked: true,
    preflightStatusContextKey: 'local'
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceAppPage appId="openmetadata" onBack={() => {}} />
      </TooltipProvider>
    )
  })
  return container
}

function connectionText(container: ParentNode): string {
  return container.querySelector('[data-marketplace-section="connection"]')?.textContent ?? ''
}

describe('the Connection token row', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    Object.assign(window, {
      api: {
        marketplaceApps: { listApps: vi.fn().mockResolvedValue([]) },
        gh: { listHostBindableAccounts: vi.fn(), switchActiveAccount: vi.fn() }
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

  it('says where the token lives and when it changed, never the value', async () => {
    const container = await mountWith(
      openMetadata({
        stored: true,
        updatedAt: Date.now() - 5 * 60_000,
        location: { hostLabel: 'my-laptop', store: 'keychain' }
      })
    )
    const text = connectionText(container)
    expect(text).toContain('Stored encrypted on my-laptop')
    expect(text).toContain('Updated')
    expect(text).not.toContain(TOKEN)
  })

  it('says Not set when nothing is stored', async () => {
    const text = connectionText(await mountWith(openMetadata({ stored: false })))
    expect(text).toContain('Not set')
    expect(text).not.toContain('Stored encrypted')
  })

  it('keeps the older wording for a status without a location', async () => {
    const text = connectionText(await mountWith(openMetadata({ stored: true })))
    expect(text).toContain('Stored in the vault. Never shown.')
  })
})
