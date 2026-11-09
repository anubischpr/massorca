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

const mocks = vi.hoisted(() => ({
  targets: [] as { kind: string; label: string; [key: string]: unknown }[],
  callRuntimeRpc: vi.fn()
}))
vi.mock('./use-marketplace-host-targets', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMarketplaceHostTargets: () => mocks.targets
}))
vi.mock('./marketplace-apps-host-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readHostApps: async () => ({ ok: true, apps: [] })
}))
vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callRuntimeRpc: mocks.callRuntimeRpc
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

const NONE = {
  ok: true,
  status: {
    hostLabel: 'This PC',
    store: 'key-file',
    services: [
      { service: 'gitlab', source: 'none', cliInstalled: true },
      { service: 'bitbucket', source: 'none' },
      { service: 'azure-devops', source: 'none' },
      { service: 'gitea', source: 'none' }
    ]
  }
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
    mocks.targets.length = 0
    seedStore(store, {
      marketplaceHostKey: null,
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

  it('shows the account scope in GitLab Advanced options', async () => {
    const container = await mount('gitlab')
    expect(container.querySelector('[data-marketplace-section="advanced"]')?.textContent).toContain(
      'Account scope'
    )
  })

  it('keeps the banner prompts on a token provider page', async () => {
    Object.assign(window, { api: { marketplaceServices: { status: vi.fn(async () => NONE) } } })
    const gitlab = await mount('gitlab')
    expect(gitlab.textContent).toContain('Which merge requests are waiting for my review?')
    // Why: every section stays on a token provider page; with no token, Danger zone says why.
    expect(sectionIds(gitlab)).toEqual(['connection', 'advanced', 'danger'])
  })
})

const TOKEN = 'fake-token-SECRET-123'
const RUNTIME = { kind: 'runtime', environmentId: 'env-1', label: 'srv2056164' }
const ALL: MarketplaceIntegrationId[] = [
  'gitlab',
  'bitbucket',
  'azure-devops',
  'gitea',
  'linear',
  'jira'
]

function storedGitea(hostLabel = 'This PC'): typeof NONE {
  return {
    ok: true,
    status: {
      hostLabel,
      store: 'key-file',
      services: NONE.status.services.map((entry) =>
        entry.service === 'gitea'
          ? { ...entry, source: 'stored', updatedAt: 1, baseUrl: 'https://git.example.com' }
          : entry
      )
    }
  }
}

async function typeInto(id: string, value: string): Promise<void> {
  const input = document.body.querySelector<HTMLInputElement>(`#${id}`)
  if (!input) {
    throw new Error(`No field: ${id}`)
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function installApi(overrides: Record<string, unknown> = {}): {
  status: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} {
  const api = {
    status: vi.fn(async () => NONE),
    connect: vi.fn(async () => storedGitea()),
    disconnect: vi.fn(async () => NONE),
    ...overrides
  }
  Object.assign(window, {
    api: {
      marketplaceServices: api,
      shell: { openUrl: vi.fn() },
      preflight: { check: vi.fn(async () => ({})) }
    }
  })
  return api
}

describe('MarketplaceIntegrationPage token entry', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.targets.length = 0
    seedStore(store, { marketplaceHostKey: null, settings })
  })

  afterEach(() => {
    for (const { container, root } of roots.splice(0)) {
      act(() => root.unmount())
      container.remove()
    }
    document.body.replaceChildren()
  })

  it.each(ALL)('shows no internal variable name on the %s page', async (integration) => {
    installApi()
    const container = await mount(integration)
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.textContent).not.toMatch(/ORCA_/)
    expect(document.body.textContent).not.toMatch(/ORCA_/)
  })

  it.each(['azure-devops', 'gitea'] as const)(
    'stores a %s token from the page, shows it connected, and Disconnect clears it',
    async (integration) => {
      const api = installApi({
        connect: vi.fn(async () => ({
          ok: true,
          status: {
            ...NONE.status,
            services: NONE.status.services.map((entry) =>
              entry.service === integration ? { ...entry, source: 'stored', updatedAt: 1 } : entry
            )
          }
        }))
      })
      const container = await mount(integration)
      await act(async () => {
        await Promise.resolve()
      })
      expect(sectionIds(container)).toEqual(['connection', 'advanced', 'danger'])
      expect(container.textContent).toContain('Not set on This computer')

      await click('Connect')
      await typeInto('integration-token', TOKEN)
      await typeInto('integration-address', 'https://git.example.com')
      await click('Save on This computer')
      expect(api.connect).toHaveBeenCalledWith({
        service: integration,
        token: TOKEN,
        baseUrl: 'https://git.example.com'
      })
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
      expect(document.body.textContent).not.toContain(TOKEN)
      expect(sectionIds(container)).toEqual(['connection', 'advanced', 'danger'])

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
      expect(api.disconnect).toHaveBeenCalledWith({ service: integration })
      expect(sectionIds(container)).toEqual(['connection', 'advanced', 'danger'])
    }
  )

  it('keeps a rejected token inside the dialog and shows the reason', async () => {
    installApi({
      connect: vi.fn(async () => ({ ok: false, reason: 'rejected', message: 'Bitbucket said no.' }))
    })
    await mount('bitbucket')
    await act(async () => {
      await Promise.resolve()
    })
    await click('Connect')
    await typeInto('integration-token', TOKEN)
    await click('Save on This computer')
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      'Bitbucket said no.'
    )
    expect(document.body.textContent).not.toContain(TOKEN)
  })

  it.each(ALL)('shows the host picker on the %s page', async (integration) => {
    installApi()
    mocks.targets.push(RUNTIME)
    const container = await mount(integration)
    expect(container.textContent).toContain('This computer')
    expect(container.querySelector('button[aria-haspopup="menu"]')).not.toBeNull()
  })

  it('sends the token to the picked paired host and never to this computer', async () => {
    const api = installApi()
    mocks.targets.push(RUNTIME)
    seedStore(store, { marketplaceHostKey: 'runtime:env-1' })
    mocks.callRuntimeRpc.mockImplementation(async (_target: unknown, method: string) =>
      method === 'marketplace.service.status' ? NONE : storedGitea('srv2056164')
    )
    await mount('gitea')
    await act(async () => {
      await Promise.resolve()
    })
    await click('Connect')
    await typeInto('integration-token', TOKEN)
    await click('Save on srv2056164')

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.service.connect',
      { service: 'gitea', token: TOKEN },
      expect.anything()
    )
    expect(api.status).not.toHaveBeenCalled()
    expect(api.connect).not.toHaveBeenCalled()
  })

  it('tells the person to update a paired host that predates the service methods', async () => {
    installApi()
    mocks.targets.push(RUNTIME)
    seedStore(store, { marketplaceHostKey: 'runtime:env-1' })
    mocks.callRuntimeRpc.mockRejectedValue({ code: 'method_not_found' })
    const container = await mount('azure-devops')
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Update MassOrca on srv2056164 first.')
  })

  it('says Not available on WSL yet with no data and no Connect for a picked distro', async () => {
    const api = installApi()
    mocks.targets.push({ kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' })
    seedStore(store, { marketplaceHostKey: 'wsl:Ubuntu' })
    for (const integration of ALL) {
      const container = await mount(integration)
      await act(async () => {
        await Promise.resolve()
      })
      expect(container.textContent).toContain('Not available on WSL yet')
      expect(container.textContent).not.toMatch(/ORCA_/)
      expect(
        Array.from(container.querySelectorAll('button')).map((b) => b.textContent)
      ).not.toContain('Connect')
    }
    expect(api.status).not.toHaveBeenCalled()
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })
})
