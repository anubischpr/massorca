// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAgentHost } from './MarketplaceAgentHostState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Probe = { detectedIds: string[] | null; detectionFailed: boolean }
type Mocks = Probe & { wsl: Probe }

const mocks = vi.hoisted((): Mocks => ({
  detectedIds: [],
  detectionFailed: false,
  wsl: { detectedIds: [], detectionFailed: false }
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/hooks/useDetectedAgents', () => ({
  useDetectedAgents: () => ({
    detectedIds: mocks.detectedIds,
    detectionFailed: mocks.detectionFailed,
    isLoading: false,
    isRefreshing: false,
    refresh: () => undefined
  })
}))

vi.mock('./marketplace-host-wsl', () => ({
  useWslAgentDetection: () => mocks.wsl
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentCatalog: () => [],
  getAgentLabel: (agent: string) => agent,
  getAgentDisplayLabel: (agent: string) => agent
}))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAgentHostPicked } = await import('./MarketplaceAgentHostPicked')

const INSTALL_URL = 'https://example.test/claude'
const LOCAL: MarketplaceAgentHost = { kind: 'local' }
const VPS: MarketplaceAgentHost = { kind: 'runtime', environmentId: 'env-1', label: 'VPS' }
const BOX: MarketplaceAgentHost = { kind: 'ssh', connectionId: 'conn-1', label: 'box' }

const roots: { container: HTMLDivElement; root: Root }[] = []

async function render(
  host: MarketplaceAgentHost,
  onDetection = vi.fn(),
  installManaged = false
): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceAgentHostPicked
          host={host}
          agentId="claude"
          installUrl={INSTALL_URL}
          installManaged={installManaged}
          onDetection={onDetection}
        />
      </TooltipProvider>
    )
  })
  return container
}

beforeEach(() => {
  mocks.detectedIds = []
  mocks.detectionFailed = false
  mocks.wsl = { detectedIds: [], detectionFailed: false }
})

afterEach(async () => {
  for (const { container, root } of roots.splice(0)) {
    await act(async () => root.unmount())
    container.remove()
  }
})

describe('MarketplaceAgentHostPicked', () => {
  it('reports the detection of its host so the page header can show it', async () => {
    const onDetection = vi.fn()
    await render(VPS, onDetection)
    expect(onDetection).toHaveBeenCalledWith('runtime:env-1', 'missing')
  })

  it('links Install on This computer, and only disables it on a remote host', async () => {
    const local = await render(LOCAL)
    expect(local.querySelector('a')?.getAttribute('href')).toBe(INSTALL_URL)
    const remote = await render(VPS)
    expect(remote.querySelector('a')).toBeNull()
    expect(remote.querySelector('button')?.disabled).toBe(true)
  })

  it('leaves Install to the page card when MassOrca installs the agent itself', async () => {
    const local = await render(LOCAL, vi.fn(), true)
    expect(local.querySelector('a')).toBeNull()
    expect(local.querySelector('button')).toBeNull()
    expect(local.textContent).toContain('Missing')
    const remote = await render(VPS, vi.fn(), true)
    expect(remote.querySelector('button')).toBeNull()
  })

  it('shows no action on a host that never answered the probe', async () => {
    mocks.detectedIds = null
    mocks.detectionFailed = true
    const onDetection = vi.fn()
    const row = await render(BOX, onDetection)
    expect(row.textContent).toContain('Could not check')
    expect(row.querySelector('button')).toBeNull()
    expect(onDetection).toHaveBeenCalledWith('ssh:conn-1', 'unverifiable')
  })
})

describe('a WSL distro host', () => {
  const UBUNTU: MarketplaceAgentHost = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' }

  it('shows Found, works and a disabled Manage when the distro has the agent', async () => {
    mocks.wsl = { detectedIds: ['claude'], detectionFailed: false }
    const row = await render(UBUNTU)
    expect(row.textContent).toContain('WSL: Ubuntu')
    expect(row.textContent).toContain('Found, works')
    expect(row.querySelector('button')?.textContent).toContain('Manage with MassOrca')
    expect(row.querySelector('button')?.disabled).toBe(true)
  })

  it('shows Missing and a disabled Install when the distro lacks the agent', async () => {
    mocks.wsl = { detectedIds: ['codex'], detectionFailed: false }
    const row = await render(UBUNTU)
    expect(row.textContent).toContain('Missing')
    expect(row.querySelector('button')?.textContent).toContain('Install')
    expect(row.querySelector('button')?.disabled).toBe(true)
  })

  it('never reads this computer for a WSL distro', async () => {
    mocks.detectedIds = ['claude']
    mocks.wsl = { detectedIds: [], detectionFailed: false }
    const row = await render(UBUNTU)
    expect(row.textContent).toContain('Missing')
    expect(row.textContent).not.toContain('Found, works')
  })

  it('says Could not check when the distro probe fails, and reports it under its WSL key', async () => {
    mocks.wsl = { detectedIds: null, detectionFailed: true }
    const onDetection = vi.fn()
    const row = await render(UBUNTU, onDetection)
    expect(row.textContent).toContain('Could not check')
    expect(row.querySelector('button')).toBeNull()
    expect(onDetection).toHaveBeenCalledWith('wsl:Ubuntu', 'unverifiable')
  })
})
