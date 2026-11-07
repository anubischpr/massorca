// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type WslProbe = { detectedIds: string[] | null; detectionFailed: boolean }
type Mocks = {
  detectedByTarget: Record<string, string[] | null>
  failedTargets: Set<string>
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
  withWsl: boolean
  wslByDistro: Record<string, WslProbe>
}

const mocks = vi.hoisted((): Mocks => ({
  detectedByTarget: {},
  failedTargets: new Set<string>(),
  updateSettings: vi.fn(),
  withWsl: false,
  wslByDistro: {}
}))

// Why: the host list must be the same array on every render, or the app host reloads forever.
const TARGETS: MarketplaceVaultHostTarget[] = [
  { kind: 'runtime', environmentId: 'env-1', label: 'VPS' },
  { kind: 'ssh', connectionId: 'conn-1', label: 'box' }
]
const TARGETS_WITH_WSL: MarketplaceVaultHostTarget[] = [
  ...TARGETS,
  { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }
]

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/agent-catalog', () => {
  const entries = [
    {
      id: 'claude',
      label: 'Claude Code',
      cmd: 'claude',
      homepageUrl: 'https://example.test/claude'
    },
    { id: 'codex', label: 'Codex', cmd: 'codex', homepageUrl: 'https://example.test/codex' }
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
  useDetectedAgents: (
    target: { kind: string; connectionId?: string; environmentId?: string } | null
  ) => {
    const key =
      target === null
        ? 'local'
        : target.kind === 'ssh'
          ? `ssh:${target.connectionId}`
          : `runtime:${target.environmentId}`
    return {
      detectedIds: mocks.detectedByTarget[key] ?? null,
      isLoading: false,
      detectionFailed: mocks.failedTargets.has(key),
      isRefreshing: false,
      refresh: vi.fn()
    }
  }
}))
vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => (mocks.withWsl ? TARGETS_WITH_WSL : TARGETS)
}))
vi.mock('./marketplace-host-wsl', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useWslAgentDetection: (distro: string | null): WslProbe =>
    distro === null
      ? { detectedIds: null, detectionFailed: false }
      : (mocks.wslByDistro[distro] ?? { detectedIds: null, detectionFailed: false })
}))
vi.mock('./marketplace-apps-host-client', () => ({
  readHostApps: () => Promise.resolve({ ok: true, apps: [] }),
  createHostMarketplaceAppsApi: () => ({})
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAgentPage } = await import('./MarketplaceAgentPage')

let root: Root | null = null
let container: HTMLDivElement | null = null

async function renderPage(onBack = vi.fn()): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <MarketplaceAgentPage agentId="claude" onBack={onBack} />
      </TooltipProvider>
    )
  })
  return container
}

function hostRow(key: string): HTMLElement {
  const row = container?.querySelector<HTMLElement>(`[data-marketplace-agent-host="${key}"]`)
  if (!row) {
    throw new Error(`Missing host row ${key}`)
  }
  return row
}

function section(scope: ParentNode, selector: string): HTMLElement {
  const found = scope.querySelector<HTMLElement>(selector)
  if (!found) {
    throw new Error(`Missing ${selector}`)
  }
  return found
}

function buttonIn(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Missing button ${text}`)
  }
  return button
}

function hostTrigger(scope: ParentNode): HTMLButtonElement | null {
  return scope.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
}

/** Opens the host dropdown the Marketplace home uses and clicks the host whose name contains label. */
async function pickHost(scope: ParentNode, label: string): Promise<void> {
  const trigger = hostTrigger(scope)
  if (!trigger) {
    throw new Error('Host list missing')
  }
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
  })
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((candidate) =>
    candidate.textContent?.includes(label)
  )
  if (!item) {
    throw new Error(`Host missing: ${label}`)
  }
  await act(async () => {
    item.click()
  })
}

beforeEach(() => {
  mocks.withWsl = false
  mocks.wslByDistro = {}
  mocks.detectedByTarget = { local: ['claude'], 'runtime:env-1': [], 'ssh:conn-1': null }
  mocks.failedTargets = new Set(['ssh:conn-1'])
  mocks.updateSettings = vi.fn()
  seedStore(store, {
    settings: getDefaultSettings('/tmp'),
    updateSettings: mocks.updateSettings,
    marketplaceHostKey: null
  })
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
  vi.restoreAllMocks()
})

describe('MarketplaceAgentPage', () => {
  it('shows the breadcrumb and returns to the catalog from Marketplace', async () => {
    const onBack = vi.fn()
    const page = await renderPage(onBack)
    const crumb = page.querySelector('nav')
    expect(crumb?.textContent).toBe('MarketplaceClaude Code')
    await act(async () => buttonIn(section(page, 'nav'), 'Marketplace').click())
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('heads the page with the name, description and status of This computer', async () => {
    const page = await renderPage()
    expect(page.querySelector('h2')?.textContent).toBe('Claude Code')
    expect(page.textContent).toContain('Coding agent from Anthropic.')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on This computer'
    )
  })

  it('puts the host dropdown next to Back, as the app pages do', async () => {
    const page = await renderPage()
    const backRow = section(page, 'nav').parentElement ?? page
    expect(hostTrigger(backRow)?.textContent).toContain('This computer')
  })

  it('shows only the picked host, with its own state and action', async () => {
    seedStore(store, { marketplaceHostKey: 'runtime:env-1' })
    const page = await renderPage()
    expect(page.querySelectorAll('[data-marketplace-agent-host]')).toHaveLength(1)
    const vps = hostRow('runtime:env-1')
    expect(vps.textContent).toContain('VPS')
    expect(vps.textContent).toContain('Not installed')
    expect(vps.textContent).toContain('Missing')
    expect(buttonIn(vps, 'Install').disabled).toBe(true)
    expect(page.querySelector('[data-marketplace-agent-host="local"]')).toBeNull()
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Not installed on VPS'
    )
  })

  it('shows a picked WSL distro with its own detection and a disabled Install', async () => {
    mocks.withWsl = true
    mocks.wslByDistro = { Ubuntu: { detectedIds: [], detectionFailed: false } }
    seedStore(store, { marketplaceHostKey: 'wsl:Ubuntu' })
    const page = await renderPage()
    expect(page.querySelectorAll('[data-marketplace-agent-host]')).toHaveLength(1)
    const row = hostRow('wsl:Ubuntu')
    expect(row.textContent).toContain('WSL: Ubuntu')
    expect(row.textContent).toContain('Missing')
    expect(buttonIn(row, 'Install').disabled).toBe(true)
    expect(page.querySelector('[data-marketplace-agent-host="local"]')).toBeNull()
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Not installed on WSL: Ubuntu'
    )
  })

  it('keeps the note that each host has its own agents', async () => {
    const page = await renderPage()
    expect(page.textContent).toContain(
      'Each host has its own agents. MassOrca updates and removes only what it manages.'
    )
  })

  it('switches the shown host and the saved pick when another host is picked', async () => {
    const page = await renderPage()
    await pickHost(page, 'box')
    expect(store.getState().marketplaceHostKey).toBe('ssh:conn-1')
    expect(page.querySelectorAll('[data-marketplace-agent-host]')).toHaveLength(1)
    const ssh = hostRow('ssh:conn-1')
    expect(ssh.textContent).toContain('SSH: box')
    expect(ssh.textContent).toContain('Could not check')
    expect(ssh.querySelector('button')).toBeNull()
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Could not check box'
    )

    await pickHost(page, 'This computer')
    expect(store.getState().marketplaceHostKey).toBeNull()
    expect(page.querySelectorAll('[data-marketplace-agent-host]')).toHaveLength(1)
    expect(buttonIn(hostRow('local'), 'Manage with MassOrca').disabled).toBe(true)
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Installed on This computer'
    )
  })

  it('links Install on This computer to the agent install page', async () => {
    mocks.detectedByTarget.local = []
    await renderPage()
    const link = hostRow('local').querySelector('a')
    expect(link?.textContent).toBe('Install')
    expect(link?.getAttribute('href')).toBe('https://example.test/claude')
  })

  it('turns the agent off and sets it as default from On This computer', async () => {
    const page = await renderPage()
    const settings = section(page, '[data-marketplace-agent-settings]')
    expect(settings.querySelector('h3')?.textContent).toBe('On This computer')
    expect(settings.textContent).toContain('Use this agent')
    expect(settings.textContent).toContain('Shows it in agent pickers on this host.')

    await act(async () => buttonIn(settings, 'Off').click())
    await vi.waitFor(() =>
      expect(mocks.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ disabledTuiAgents: expect.arrayContaining(['claude']) })
      )
    )

    await act(async () => buttonIn(settings, 'Set as default').click())
    expect(mocks.updateSettings).toHaveBeenCalledWith({ defaultTuiAgent: 'claude' })
  })

  it('shows the launch command and variables and opens their editors with Edit', async () => {
    const page = await renderPage()
    const settings = section(page, '[data-marketplace-agent-settings]')
    expect(settings.textContent).toContain('Launch command')
    expect(settings.textContent).toContain('Environment variables')
    expect(settings.textContent).toContain('0 variables')
    const [commandEdit, envEdit] = [...settings.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Edit'
    )
    expect(settings.querySelectorAll('input').length).toBe(0)
    await act(async () => commandEdit.click())
    expect(commandEdit.getAttribute('aria-expanded')).toBe('true')
    expect(settings.querySelectorAll('input').length).toBeGreaterThan(0)
    await act(async () => envEdit.click())
    expect(envEdit.getAttribute('aria-expanded')).toBe('true')
    expect(commandEdit.getAttribute('aria-expanded')).toBe('false')
  })
})
