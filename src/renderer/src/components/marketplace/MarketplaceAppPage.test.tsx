// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAppId, MarketplaceAppStatus } from '../../../../shared/marketplace-apps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const apps: MarketplaceAppStatus[] = []
  return {
    apps,
    listApps: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setOpenMetadataToken: vi.fn(),
    addOpenMetadataProfile: vi.fn(),
    removeOpenMetadataProfile: vi.fn(),
    setEngramServer: vi.fn(),
    writeClipboardText: vi.fn(),
    openUrl: vi.fn(),
    listHostBindableAccounts: vi.fn()
  }
})

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

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAppPage } = await import('./MarketplaceAppPage')

const engram: MarketplaceAppStatus = {
  id: 'engram',
  connected: true,
  program: { found: true, version: '0.9.2' },
  credential: { stored: false },
  serverUrl: null,
  agents: [
    { agent: 'claude', level: 'full', entry: 'set' },
    { agent: 'codex', level: 'full', entry: 'built-in' },
    { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
    { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
  ]
}

const openmetadata: MarketplaceAppStatus = {
  id: 'openmetadata',
  connected: true,
  serverUrl: 'https://metadata.example.com',
  credential: { stored: true },
  profiles: [{ name: 'prod', url: 'https://prod.example.com', hasToken: true }],
  agents: [
    { agent: 'claude', level: 'full', entry: 'set' },
    { agent: 'codex', level: 'full', entry: 'set' },
    { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
    { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
  ]
}

const github: MarketplaceAppStatus = { id: 'github', connected: true, agents: [] }

const roots: { container: HTMLDivElement; root: Root }[] = []

async function mount(appId: MarketplaceAppId): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceAppPage appId={appId} onBack={() => {}} />
      </TooltipProvider>
    )
  })
  return container
}

function sectionOf(container: ParentNode, id: string): HTMLElement {
  const section = container.querySelector<HTMLElement>(`[data-marketplace-section="${id}"]`)
  if (!section) {
    throw new Error(`Section ${id} missing`)
  }
  return section
}

function headerOf(container: ParentNode): HTMLElement {
  const header = container.querySelector<HTMLElement>('header')
  if (!header) {
    throw new Error('Header missing')
  }
  return header
}

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
}

function clickButton(scope: ParentNode, text: string): Promise<void> {
  const button = buttonWithText(scope, text)
  if (!button) {
    throw new Error(`Button missing: ${text}`)
  }
  return act(async () => {
    button.click()
  })
}

function inputById(id: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)
  if (!input) {
    throw new Error(`Input missing: ${id}`)
  }
  return input
}

function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  return act(async () => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function submitDialog(): Promise<void> {
  const form = document.querySelector('form')
  if (!form) {
    throw new Error('Dialog form missing')
  }
  return act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function sectionIds(container: ParentNode): (string | null)[] {
  return [...container.querySelectorAll('[data-marketplace-section]')].map((section) =>
    section.getAttribute('data-marketplace-section')
  )
}

function seedApps(apps: MarketplaceAppStatus[]): void {
  mocks.apps = apps
  seedStore(store, { marketplaceApps: { status: 'ready', apps } })
}

describe('MarketplaceAppPage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.listApps.mockImplementation(async () => mocks.apps)
    mocks.connect.mockResolvedValue({ ok: true, status: engram })
    mocks.disconnect.mockResolvedValue({ ok: true, status: { ...engram, connected: false } })
    mocks.setOpenMetadataToken.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.addOpenMetadataProfile.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.removeOpenMetadataProfile.mockResolvedValue({ ok: true, status: openmetadata })
    mocks.setEngramServer.mockResolvedValue({ ok: true, status: engram })
    mocks.writeClipboardText.mockResolvedValue(undefined)
    mocks.openUrl.mockResolvedValue(undefined)
    mocks.listHostBindableAccounts.mockResolvedValue({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'personal',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo']
        }
      ]
    })
    Object.assign(window, {
      api: {
        marketplaceApps: {
          listApps: mocks.listApps,
          connect: mocks.connect,
          disconnect: mocks.disconnect,
          setOpenMetadataToken: mocks.setOpenMetadataToken,
          addOpenMetadataProfile: mocks.addOpenMetadataProfile,
          removeOpenMetadataProfile: mocks.removeOpenMetadataProfile,
          setEngramServer: mocks.setEngramServer
        },
        ui: { writeClipboardText: mocks.writeClipboardText },
        shell: { openUrl: mocks.openUrl },
        gh: {
          listHostBindableAccounts: mocks.listHostBindableAccounts,
          switchActiveAccount: vi.fn()
        }
      }
    })
    seedStore(store, {
      activeView: 'marketplace',
      marketplaceApps: { status: 'ready', apps: [engram, openmetadata, github] },
      preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: true } },
      preflightStatusChecked: true,
      preflightStatusContextKey: 'local'
    })
    mocks.apps = [engram, openmetadata, github]
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  describe.each<MarketplaceAppId>(['engram', 'openmetadata', 'github'])('the %s page', (appId) => {
    it('shows Connection, Information, Advanced options and Danger zone in that order', async () => {
      const container = await mount(appId)
      expect(sectionIds(container)).toEqual(['connection', 'information', 'advanced', 'danger'])
    })

    it('has no per-agent switches in Connection', async () => {
      const container = await mount(appId)
      expect(sectionOf(container, 'connection').querySelectorAll('[role="switch"]')).toHaveLength(0)
    })
  })

  it('shows each agent with its integration level or Built in in Information', async () => {
    const container = await mount('engram')
    const rows = [...sectionOf(container, 'information').querySelectorAll('li')].map(
      (row) => row.textContent ?? ''
    )
    expect(rows).toHaveLength(4)
    expect(rows[0]).toContain('Claude Code')
    expect(rows[0]).toContain('Full integration')
    expect(rows[1]).toContain('Codex')
    expect(rows[1]).toContain('Built in')
    expect(rows[2]).toContain('Antigravity')
    expect(rows[2]).toContain('Tools only')
    expect(rows[3]).toContain('Gentle Shell')
    expect(rows[3]).toContain('Tools only')
  })

  it('connects OpenMetadata with the address and token, and never shows the token', async () => {
    seedApps([
      engram,
      {
        ...openmetadata,
        connected: false,
        serverUrl: null,
        credential: { stored: false },
        profiles: []
      },
      github
    ])
    mocks.connect.mockResolvedValue({ ok: true, status: openmetadata })
    const container = await mount('openmetadata')

    await clickButton(headerOf(container), 'Connect')
    await typeInto(inputById('marketplace-openmetadata-address'), 'https://metadata.example.com')
    await typeInto(inputById('marketplace-openmetadata-token'), 'token-value-42')
    await submitDialog()

    expect(mocks.connect).toHaveBeenCalledWith({
      id: 'openmetadata',
      url: 'https://metadata.example.com',
      token: 'token-value-42'
    })
    expect(document.body.textContent).not.toContain('token-value-42')
  })

  it('connects Engram from the header and reports a missing install', async () => {
    seedApps([{ ...engram, connected: false }, openmetadata, github])
    const container = await mount('engram')
    await clickButton(headerOf(container), 'Connect')
    expect(mocks.connect).toHaveBeenCalledWith({ id: 'engram' })

    seedApps([
      { ...engram, connected: false, program: { found: false, version: null } },
      openmetadata,
      github
    ])
    const missing = await mount('engram')
    expect(sectionOf(missing, 'connection').textContent).toContain('Not found')
    expect(buttonWithText(sectionOf(missing, 'connection'), 'Install instructions')).toBeDefined()
    expect(buttonWithText(headerOf(missing), 'Connect')?.disabled).toBe(true)
  })

  it('asks before disconnecting, then disconnects and refreshes the status', async () => {
    const container = await mount('engram')

    await clickButton(sectionOf(container, 'danger'), 'Disconnect')
    expect(mocks.disconnect).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Disconnect Engram?')

    mocks.apps = [{ ...engram, connected: false }, openmetadata, github]
    await submitDialog()

    expect(mocks.disconnect).toHaveBeenCalledWith({ id: 'engram' })
    expect(headerOf(container).textContent).toContain('Not connected')
  })

  it('removes and adds OpenMetadata profiles through the server', async () => {
    const container = await mount('openmetadata')

    await clickButton(sectionOf(container, 'advanced'), 'Remove')
    expect(mocks.removeOpenMetadataProfile).toHaveBeenCalledWith({ name: 'prod' })

    await clickButton(sectionOf(container, 'advanced'), 'Add a profile')
    await typeInto(inputById('marketplace-profile-name'), 'staging')
    await typeInto(inputById('marketplace-profile-address'), 'https://staging.example.com')
    await typeInto(inputById('marketplace-profile-token'), 'staging-token')
    await submitDialog()

    expect(mocks.addOpenMetadataProfile).toHaveBeenCalledWith({
      name: 'staging',
      url: 'https://staging.example.com',
      token: 'staging-token'
    })
  })

  it('copies the deep link and an example prompt with its @ mention', async () => {
    const container = await mount('engram')

    await clickButton(headerOf(container), 'Copy link')
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('massorca://marketplace/engram')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Copy this prompt"]')?.click()
    })
    expect(mocks.writeClipboardText).toHaveBeenCalledWith(
      '@Engram What did we decide about the release branch last week?'
    )
  })

  it('copies the gh login command for a new GitHub account, with no Connect button', async () => {
    const container = await mount('github')

    expect(buttonWithText(headerOf(container), 'Connect')).toBeUndefined()
    await clickButton(sectionOf(container, 'connection'), 'Add account')

    expect(mocks.writeClipboardText).toHaveBeenCalledWith('gh auth login')
  })

  it('shows the active GitHub account for new projects in Advanced options', async () => {
    const container = await mount('github')
    await act(async () => {})
    expect(sectionOf(container, 'advanced').textContent).toContain('personal')
  })

  it('sets the address of your own Engram server through a dialog', async () => {
    const container = await mount('engram')

    await clickButton(sectionOf(container, 'advanced'), 'Add')
    await typeInto(inputById('marketplace-engram-server'), 'https://engram.example.com')
    await submitDialog()

    expect(mocks.setEngramServer).toHaveBeenCalledWith({ url: 'https://engram.example.com' })
  })

  it('shows the desktop-only notice and no sections without the desktop bridge', async () => {
    Object.assign(window, { api: undefined })
    seedStore(store, { marketplaceApps: { status: 'unavailable' } })
    const container = await mount('openmetadata')

    expect(container.textContent).toContain('Available in the desktop app')
    expect(sectionIds(container)).toEqual([])
  })
})
