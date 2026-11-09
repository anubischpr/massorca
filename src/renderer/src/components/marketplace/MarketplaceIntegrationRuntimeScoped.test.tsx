// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ callRuntimeRpc: vi.fn() }))

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { MarketplaceRuntimeScopedIntegration } =
  await import('./MarketplaceIntegrationRuntimeScoped')

const runtime: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-1',
  label: 'pv-vps'
}
const environment = { kind: 'environment', environmentId: 'env-1' }
const roots: { container: HTMLDivElement; root: Root }[] = []

async function mount(id: 'linear' | 'jira'): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceRuntimeScopedIntegration id={id} target={runtime} />
      </TooltipProvider>
    )
  })
  await act(async () => {})
  return container
}

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
}

// Why: each Danger item is its own card, so its Disconnect button is found through the card title.
function disconnectButtonFor(container: ParentNode, title: string): HTMLButtonElement | undefined {
  const card = [...container.querySelectorAll<HTMLElement>('[data-slot="card"]')].find(
    (element) => element.textContent?.includes(title) === true
  )
  return card ? buttonWithText(card, 'Disconnect') : undefined
}

async function confirmDisconnect(): Promise<void> {
  const confirm = [...document.body.querySelectorAll('[role="dialog"] button')].find(
    (button) => button.textContent?.trim() === 'Disconnect'
  )
  if (!(confirm instanceof HTMLButtonElement)) {
    throw new Error('No Disconnect confirm button')
  }
  await act(async () => {
    confirm.click()
  })
}

describe('MarketplaceRuntimeScopedIntegration on a picked runtime host', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedStore(store, { settings: getDefaultSettings('/tmp') })
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  it('shows the Linear workspaces that the picked host reports', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({
      connected: true,
      viewer: null,
      workspaces: [
        {
          id: 'ws-1',
          organizationId: 'org-1',
          organizationName: 'Acme',
          displayName: 'Ana',
          email: null
        }
      ]
    })

    const container = await mount('linear')

    expect(mocks.callRuntimeRpc.mock.calls[0]?.[0]).toEqual(environment)
    expect(mocks.callRuntimeRpc.mock.calls[0]?.[1]).toBe('linear.status')
    expect(container.textContent).toContain('Acme')
    expect(container.textContent).not.toContain('not available from this page yet')
  })

  it('disconnects every Linear workspace on the picked host', async () => {
    mocks.callRuntimeRpc.mockImplementation(async (_target: unknown, method: string) =>
      method === 'linear.status'
        ? {
            connected: true,
            viewer: null,
            workspaces: [
              {
                id: 'ws-1',
                organizationId: 'org-1',
                organizationName: 'Acme',
                displayName: 'Ana',
                email: null
              }
            ]
          }
        : { ok: true }
    )
    const container = await mount('linear')

    await act(async () => {
      disconnectButtonFor(container, 'Disconnect Linear')?.click()
    })
    await confirmDisconnect()

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      environment,
      'linear.disconnect',
      {},
      expect.anything()
    )
  })

  it('disconnects one Linear workspace on the picked host by its id', async () => {
    mocks.callRuntimeRpc.mockImplementation(async (_target: unknown, method: string) =>
      method === 'linear.status'
        ? {
            connected: true,
            viewer: null,
            workspaces: [
              {
                id: 'ws-1',
                organizationId: 'org-1',
                organizationName: 'Acme',
                displayName: 'Ana',
                email: null
              }
            ]
          }
        : { ok: true }
    )
    const container = await mount('linear')

    await act(async () => {
      disconnectButtonFor(container, 'Disconnect Acme')?.click()
    })
    await confirmDisconnect()

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      environment,
      'linear.disconnect',
      { workspaceId: 'ws-1' },
      expect.anything()
    )
  })

  it('says to update the picked host when it predates Linear over its runtime', async () => {
    mocks.callRuntimeRpc.mockRejectedValue({ code: 'method_not_found' })

    const container = await mount('linear')

    expect(container.textContent).toContain('Update MassOrca on pv-vps first.')
  })

  it('shows the Jira sites that the picked host reports and disconnects one by its id', async () => {
    mocks.callRuntimeRpc.mockImplementation(async (_target: unknown, method: string) =>
      method === 'jira.status'
        ? {
            connected: true,
            viewer: null,
            sites: [
              {
                id: 'site-1',
                siteUrl: 'https://acme.atlassian.net',
                email: 'ana@acme.test',
                displayName: 'Ana',
                accountId: 'acc-1'
              }
            ]
          }
        : { ok: true }
    )
    const container = await mount('jira')
    expect(container.textContent).toContain('https://acme.atlassian.net')

    await act(async () => {
      disconnectButtonFor(container, 'Disconnect https://acme.atlassian.net')?.click()
    })
    await confirmDisconnect()

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      environment,
      'jira.disconnect',
      { siteId: 'site-1' },
      expect.anything()
    )
  })
})
