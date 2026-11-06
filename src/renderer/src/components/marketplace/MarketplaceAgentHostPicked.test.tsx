// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceAgentHost } from './MarketplaceAgentHostState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Mocks = { detectedIds: string[] | null; detectionFailed: boolean }

const mocks = vi.hoisted((): Mocks => ({ detectedIds: [], detectionFailed: false }))

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

async function render(host: MarketplaceAgentHost, onDetection = vi.fn()): Promise<HTMLDivElement> {
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
