// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceBadgeState } from './marketplace-status'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted((): { host: MarketplaceAppHost | undefined } => ({ host: undefined }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => agent,
  getAgentDisplayLabel: (agent: string) => agent
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('./use-marketplace-app-host', () => ({
  useMarketplaceAppHost: () => mocks.host
}))
vi.mock('./GitInstallController', () => ({
  useGitInstallController: () => ({
    view: { kind: 'checking' },
    install: () => undefined,
    adopt: () => undefined,
    recheck: () => undefined
  })
}))

const { createTestStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceDetail } = await import('./MarketplaceDetail')
const { createHostMarketplaceAppsApi } = await import('./marketplace-apps-host-client')
const { MARKETPLACE_CATALOG } = await import('./marketplace-catalog')

const gitItem = MARKETPLACE_CATALOG.find((item) => item.id === 'git')
const runtimeTarget: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-1',
  label: 'srv2056164'
}

/** This computer, or the paired server picked from the same host list the Marketplace uses. */
function hostOf(pickedRuntime: boolean): MarketplaceAppHost {
  return {
    targets: [runtimeTarget],
    selectedKey: pickedRuntime ? 'runtime:env-1' : null,
    select: () => undefined,
    apps: { status: 'ready', apps: [] },
    failure: null,
    scope: pickedRuntime
      ? {
          label: runtimeTarget.label,
          api: createHostMarketplaceAppsApi(runtimeTarget),
          reload: () => Promise.resolve()
        }
      : null,
    wslDistro: null,
    retry: () => undefined
  }
}

const roots: { container: HTMLDivElement; root: Root }[] = []

async function mount(badgeState: MarketplaceBadgeState): Promise<HTMLDivElement> {
  if (!gitItem) {
    throw new Error('Git is missing from the Marketplace catalog')
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceDetail item={gitItem} badgeState={badgeState} onBack={() => {}} />
      </TooltipProvider>
    )
  })
  return container
}

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
}

function hostTrigger(scope: ParentNode): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')].at(0)
}

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  document.body.replaceChildren()
})

describe('MarketplaceDetail on the Git page', () => {
  beforeEach(() => {
    mocks.host = hostOf(false)
  })

  it('shows the host dropdown next to Back, with This computer alone', async () => {
    const container = await mount('installed')
    expect(buttonWithText(container, 'Back')).toBeDefined()
    expect(hostTrigger(container)?.textContent).toContain('This computer')
  })

  it("keeps this computer's own Git state and its Get Git action", async () => {
    const container = await mount('not-installed')
    expect(container.textContent).toContain('Git is not installed on this computer.')
    expect(buttonWithText(container, 'Get Git')).toBeDefined()
  })

  it('shows what the picked host reports for Git, not this computer', async () => {
    mocks.host = hostOf(true)
    const container = await mount('not-installed')
    expect(hostTrigger(container)?.textContent).toContain('srv2056164')
    expect(container.textContent).toContain('Git is not installed on srv2056164.')
    expect(container.textContent).not.toContain('on this computer')
    expect(buttonWithText(container, 'Get Git')).toBeUndefined()
  })
})
