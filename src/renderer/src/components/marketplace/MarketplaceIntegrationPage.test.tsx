// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { MarketplaceIntegrationId } from './marketplace-integrations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

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
  getAgentCatalog: () => [],
  getAgentLabel: (agent: string) => agent,
  getAgentDisplayLabel: (agent: string) => agent
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
// Why: the real refresh would overwrite the connection states these tests seed.
vi.mock('../settings/use-integration-provider-status-refresh', () => ({
  useIntegrationProviderStatusRefresh: () => undefined
}))
vi.mock('../settings/linear-agent-skill-install-cta', () => ({
  LinearAgentSkillInstallCta: () => null
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { getProviderRuntimeContextKey } = await import('@/lib/provider-runtime-context')
const { MarketplaceIntegrationPage } = await import('./MarketplaceIntegrationPage')

const roots: { container: HTMLDivElement; root: Root }[] = []
const settings = getDefaultSettings('/tmp')

async function mount(integration: MarketplaceIntegrationId): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(<MarketplaceIntegrationPage integration={integration} onBack={() => {}} />)
  })
  return container
}

function sectionIds(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll('[data-marketplace-section]')).map(
    (section) => section.getAttribute('data-marketplace-section') ?? ''
  )
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

async function click(text: string): Promise<void> {
  const button = buttonWithText(text)
  await act(async () => {
    button.click()
  })
}

describe('MarketplaceIntegrationPage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    Object.assign(window, { api: undefined })
    seedStore(store, {
      settings,
      preflightStatus: {
        git: { installed: true },
        gh: { installed: true, authenticated: true },
        glab: { installed: true, authenticated: true },
        bitbucket: { configured: false, authenticated: false, account: null },
        azureDevOps: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        },
        gitea: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        }
      },
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

  it('shows Linear with a banner, Connection, Advanced options and a Danger zone that disconnects', async () => {
    const disconnectLinear = vi.fn(async () => undefined)
    seedStore(store, {
      linearStatus: {
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
      },
      linearStatusChecked: true,
      linearStatusContextKey: getProviderRuntimeContextKey(settings),
      disconnectLinear
    })
    const container = await mount('linear')

    expect(container.querySelector('h2')?.textContent).toBe('Linear')
    expect(container.textContent).toContain('What Linear issues are assigned to me?')
    expect(container.textContent).toContain('Acme')
    expect(sectionIds(container)).toEqual(['connection', 'advanced', 'danger'])

    await click('Disconnect')
    expect(disconnectLinear).not.toHaveBeenCalled()
    const confirm = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
      (candidate) => candidate.textContent?.trim() === 'Disconnect'
    )
    await act(async () => {
      if (!(confirm instanceof HTMLButtonElement)) {
        throw new Error('No Disconnect confirm button')
      }
      confirm.click()
    })
    expect(disconnectLinear).toHaveBeenCalledTimes(1)
  })

  it('shows Bitbucket Danger zone only for a saved credential and removes it through the existing call', async () => {
    const disconnect = vi.fn(async () => undefined)
    Object.assign(window, {
      api: {
        bitbucket: {
          status: vi.fn(async () => ({
            configured: true,
            source: 'stored',
            account: 'ana',
            authMode: 'token',
            email: null,
            baseUrl: null
          })),
          disconnect
        },
        shell: { openUrl: vi.fn() }
      }
    })
    const container = await mount('bitbucket')
    await act(async () => {
      await Promise.resolve()
    })

    expect(sectionIds(container)).toEqual(['connection', 'danger'])
    await click('Disconnect')
    const confirm = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
      (candidate) => candidate.textContent?.trim() === 'Disconnect'
    )
    await act(async () => {
      if (!(confirm instanceof HTMLButtonElement)) {
        throw new Error('No Disconnect confirm button')
      }
      confirm.click()
    })
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('shows GitLab and the token providers without a Danger zone, since sign-in lives outside MassOrca', async () => {
    const gitlab = await mount('gitlab')
    expect(sectionIds(gitlab)).toEqual(['connection', 'advanced'])
    expect(gitlab.textContent).toContain('Which merge requests are waiting for my review?')

    const gitea = await mount('gitea')
    expect(sectionIds(gitea)).toEqual(['connection'])
  })
})
