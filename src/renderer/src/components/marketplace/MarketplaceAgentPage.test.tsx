// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Mocks = {
  detectedByTarget: Record<string, string[] | null>
  failedTargets: Set<string>
  wslDetected: string[] | null
  state: {
    settings: GlobalSettings | null
    updateSettings: (updates: Partial<GlobalSettings>) => void
  }
}

const mocks = vi.hoisted((): Mocks => ({
  detectedByTarget: {},
  failedTargets: new Set<string>(),
  wslDetected: null,
  state: { settings: null, updateSettings: () => undefined }
}))

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
vi.mock('@/lib/web-client-location', () => ({ isWebClientLocation: () => false }))
vi.mock('@/lib/windows-terminal-capabilities', () => ({
  useLocalWindowsTerminalCapabilities: () => ({ wslDistros: ['Ubuntu'], isLoading: false })
}))
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
vi.mock('../skills/use-skill-install-detected-agents', () => ({
  useSkillInstallDetectedAgents: () => mocks.wslDetected
}))
vi.mock('./use-marketplace-host-targets', () => ({
  useMarketplaceHostTargets: () => [
    { kind: 'runtime', environmentId: 'env-1', label: 'VPS' },
    { kind: 'ssh', connectionId: 'conn-1', label: 'box' }
  ]
}))
vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    { getState: () => mocks.state }
  )
  return { useAppStore }
})

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

beforeEach(() => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0)')
  mocks.detectedByTarget = { local: ['claude'], 'runtime:env-1': [], 'ssh:conn-1': null }
  mocks.failedTargets = new Set(['ssh:conn-1'])
  mocks.wslDetected = ['claude']
  mocks.state.settings = getDefaultSettings('/tmp')
  mocks.state.updateSettings = vi.fn()
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

  it('heads the page with the name, description and host count', async () => {
    const page = await renderPage()
    expect(page.querySelector('h2')?.textContent).toBe('Claude Code')
    expect(page.textContent).toContain('Coding agent from Anthropic.')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'On 2 of 4 hosts · works on 2'
    )
  })

  it('lists This computer, the paired server, WSL and SSH with their state and action', async () => {
    await renderPage()
    const local = hostRow('local')
    expect(local.textContent).toContain('This computer')
    expect(local.textContent).toContain('Found, works')
    expect(buttonIn(local, 'Manage with MassOrca').disabled).toBe(true)

    const vps = hostRow('runtime:env-1')
    expect(vps.textContent).toContain('VPS')
    expect(vps.textContent).toContain('Not installed')
    expect(vps.textContent).toContain('Missing')
    expect(buttonIn(vps, 'Install').disabled).toBe(true)

    expect(hostRow('wsl:Ubuntu').textContent).toContain('WSL: Ubuntu')
    expect(hostRow('wsl:Ubuntu').textContent).toContain('Found, works')

    const ssh = hostRow('ssh:conn-1')
    expect(ssh.textContent).toContain('SSH: box')
    expect(ssh.textContent).toContain('Could not check')
    expect(ssh.querySelector('button')).toBeNull()
    expect(container?.textContent).toContain(
      'Each host has its own agents. MassOrca updates and removes only what it manages.'
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
      expect(mocks.state.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ disabledTuiAgents: expect.arrayContaining(['claude']) })
      )
    )

    await act(async () => buttonIn(settings, 'Set as default').click())
    expect(mocks.state.updateSettings).toHaveBeenCalledWith({ defaultTuiAgent: 'claude' })
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
