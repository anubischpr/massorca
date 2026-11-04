// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted((): { agents: string[] | null } => ({ agents: [] }))

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
  getAgentLabel: (agent: string) => {
    const labels: Record<string, string> = {
      claude: 'Claude Code',
      codex: 'Codex',
      antigravity: 'Antigravity'
    }
    return labels[agent] ?? agent
  }
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('./use-marketplace-agents', () => ({ useMarketplaceAgents: () => mocks.agents }))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { default: MarketplacePage } = await import('./MarketplacePage')

const roots: { container: HTMLDivElement; root: Root }[] = []

async function renderPage(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplacePage />
      </TooltipProvider>
    )
  })
  return container
}

// Why: badges also carry font-medium, so the row name is matched by its block layout class.
const NAME_SELECTOR = 'span.block.font-medium'

function rowFor(container: ParentNode, name: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('li button')).find(
    (button) => button.querySelector(NAME_SELECTOR)?.textContent === name
  )
}

function buttonWithText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
}

function clickButtonWithText(container: ParentNode, text: string): Promise<void> {
  const button = buttonWithText(container, text)
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return act(async () => {
    button.click()
  })
}

function listedNames(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll(`li ${NAME_SELECTOR}`)).map(
    (name) => name.textContent ?? ''
  )
}

const connectedEngram: MarketplaceAppStatus = { id: 'engram', connected: true, agents: [] }
const disconnectedOpenMetadata: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: false,
  agents: []
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.agents = ['claude', 'gentle-shell']
    // Why: the web client has no marketplace bridge; the page must still render.
    Object.assign(window, { api: undefined })
    seedStore(store, {
      activeView: 'marketplace',
      marketplaceSection: 'all',
      marketplaceSelectedItemId: null,
      preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: false } },
      preflightStatusChecked: true,
      preflightStatusContextKey: 'local'
    })
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  it('lists the four items with the status known on this computer', async () => {
    const container = await renderPage()

    const badgeFor = (name: string): string | null | undefined =>
      rowFor(container, name)?.querySelector('[data-slot="badge"]')?.textContent

    expect(listedNames(container)).toEqual(['Git', 'GitHub', 'Engram', 'OpenMetadata'])
    expect(badgeFor('Git')).toBe('Installed')
    expect(badgeFor('GitHub')).toBe('Not signed in')
    expect(badgeFor('Engram')).toBe('Available in the desktop app')
    expect(badgeFor('OpenMetadata')).toBe('Available in the desktop app')
    expect(buttonWithText(container, 'Tools')).toBeUndefined()
    expect(container.textContent).toContain(
      'Only this computer for now. SSH and WSL hosts come later.'
    )
  })

  it('paints the page root with the Bot teams main background', async () => {
    const container = await renderPage()
    expect(container.firstElementChild?.classList.contains('bg-chat-canvas')).toBe(true)
  })

  it('shows Connected or Not connected for the apps the desktop lists', async () => {
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: vi.fn(async () => [connectedEngram, disconnectedOpenMetadata])
        }
      }
    })
    const container = await renderPage()
    await act(async () => {})

    const badgeFor = (name: string): string | null | undefined =>
      rowFor(container, name)?.querySelector('[data-slot="badge"]')?.textContent
    expect(badgeFor('Engram')).toBe('Connected')
    expect(badgeFor('OpenMetadata')).toBe('Not connected')
  })

  it('lists the rows of the section the sidebar picked', async () => {
    seedStore(store, { marketplaceSection: 'tools' })
    const tools = await renderPage()
    expect(listedNames(tools)).toEqual(['Git', 'Engram'])

    seedStore(store, { marketplaceSection: 'services' })
    const services = await renderPage()
    expect(listedNames(services)).toEqual(['GitHub', 'OpenMetadata'])
  })

  it('opens Git from its row and returns to the catalog with Back', async () => {
    const container = await renderPage()

    await act(async () => {
      rowFor(container, 'Git')?.click()
    })
    expect(container.textContent).toContain('Git is installed on this computer.')

    await clickButtonWithText(container, 'Back')

    expect(listedNames(container)).toEqual(['Git', 'GitHub', 'Engram', 'OpenMetadata'])
  })

  it('opens the standard app page for an app row', async () => {
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: vi.fn(async () => [connectedEngram, disconnectedOpenMetadata])
        }
      }
    })
    const container = await renderPage()
    await act(async () => {})

    await act(async () => {
      rowFor(container, 'Engram')?.click()
    })

    expect(container.querySelector('[data-marketplace-section="connection"]')).not.toBeNull()
    expect(container.textContent).toContain('Engram on this computer')
  })

  it('lists the detected agents in the Agents section, with a link to Settings', async () => {
    seedStore(store, { marketplaceSection: 'agents' })
    const container = await renderPage()

    expect(container.textContent).toContain('Claude Code')
    expect(container.textContent).toContain('Gentle Shell')

    await clickButtonWithText(container, 'Open Agents in Settings')

    expect(store.getState().activeView).toBe('settings')
    expect(store.getState().settingsNavigationTarget?.pane).toBe('agents')
  })

  it('links the Skills section to the Skills page', async () => {
    seedStore(store, { marketplaceSection: 'skills' })
    const container = await renderPage()

    await clickButtonWithText(container, 'Open Skills')

    expect(store.getState().activeView).toBe('skills')
  })
})
