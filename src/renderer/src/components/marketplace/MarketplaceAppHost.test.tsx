// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { MarketplaceAppId, MarketplaceAppStatus } from '../../../../shared/marketplace-apps'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  localListApps: vi.fn(),
  localConnect: vi.fn(),
  remoteListApps: vi.fn(),
  remoteConnect: vi.fn(),
  listHostBindableAccounts: vi.fn()
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callRuntimeRpc: mocks.callRuntimeRpc
}))
vi.mock('@/lib/local-preflight-context', () => ({
  getLocalPreflightContext: () => ({}),
  localPreflightContextKey: () => 'local'
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => agent
}))
vi.mock('@/lib/agent-icon-gentle-shell', () => ({ GentleShellIcon: () => null }))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('@/components/bot-teams/use-bot-teams', () => ({
  useBotTeams: () => ({
    teams: [],
    failed: false,
    lastSeenAt: null,
    reload: () => undefined,
    applyChange: async () => true
  })
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceAppPage } = await import('./MarketplaceAppPage')

const AGENTS = [
  { agent: 'claude', level: 'full', entry: 'missing' },
  { agent: 'codex', level: 'full', entry: 'missing' },
  { agent: 'antigravity', level: 'tools-only', entry: 'missing' },
  { agent: 'gentle-shell', level: 'tools-only', entry: 'missing' }
] as const

function engramStatus(connected: boolean, version: string): MarketplaceAppStatus {
  return {
    id: 'engram',
    connected,
    program: { found: true, version },
    credential: { stored: false },
    serverUrl: null,
    agents: [...AGENTS]
  }
}

const localEngram = engramStatus(false, '0.1.0-local')
const remoteEngram = engramStatus(false, '9.9.9-remote')

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

function buttonWithText(scope: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
}

async function clickButton(scope: ParentNode, text: string): Promise<void> {
  const button = buttonWithText(scope, text)
  if (!button) {
    throw new Error(`Button missing: ${text}`)
  }
  await act(async () => {
    button.click()
  })
}

function seedHosts(hosts: { runtime?: boolean; ssh?: boolean }): void {
  seedStore(store, {
    settings: {
      ...getDefaultSettings('/tmp'),
      activeRuntimeEnvironmentId: hosts.runtime ? 'env-1' : null
    },
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the host list reads only id and name.
    runtimeEnvironments: hosts.runtime ? [{ id: 'env-1', name: 'srv2056164' } as never] : [],
    sshConnectionStates: new Map(
      hosts.ssh
        ? [['ssh-1', { targetId: 'ssh-1', status: 'connected', error: null, reconnectAttempt: 0 }]]
        : []
    ),
    sshTargetLabels: new Map(hosts.ssh ? [['ssh-1', 'build-box']] : [])
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.localListApps.mockResolvedValue([localEngram])
  mocks.localConnect.mockResolvedValue({ ok: true, status: localEngram })
  mocks.remoteListApps.mockResolvedValue({ ok: true, apps: [remoteEngram] })
  mocks.remoteConnect.mockResolvedValue({ ok: true, status: engramStatus(true, '9.9.9-remote') })
  mocks.listHostBindableAccounts.mockResolvedValue({ capability: 'supported', accounts: [] })
  Object.assign(window, {
    api: {
      marketplaceApps: {
        listApps: mocks.localListApps,
        connect: mocks.localConnect,
        remote: { listApps: mocks.remoteListApps, connect: mocks.remoteConnect }
      },
      ui: { writeClipboardText: vi.fn() },
      shell: { openUrl: vi.fn() },
      gh: {
        listHostBindableAccounts: mocks.listHostBindableAccounts,
        switchActiveAccount: vi.fn(),
        startSignIn: vi.fn(async () => ({ ok: true })),
        cancelSignIn: vi.fn(async () => {}),
        onSignInEvent: vi.fn(() => () => {})
      }
    }
  })
  seedStore(store, {
    activeView: 'marketplace',
    marketplaceApps: { status: 'ready', apps: [localEngram] },
    preflightStatus: { git: { installed: true }, gh: { installed: true, authenticated: true } },
    preflightStatusChecked: true,
    preflightStatusContextKey: 'local'
  })
  seedHosts({})
})

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  document.body.replaceChildren()
})

describe('the host picker on an app page', () => {
  it('shows no picker when this computer is the only host', async () => {
    const container = await mount('engram')
    expect(container.querySelector('[role="group"]')).toBeNull()
    expect(container.textContent).toContain('0.1.0-local')
  })

  it('lists this computer, the paired server and the connected SSH hosts', async () => {
    seedHosts({ runtime: true, ssh: true })
    const container = await mount('engram')
    const labels = [
      ...(container.querySelector('[role="group"]')?.querySelectorAll('button') ?? [])
    ].map((button) => button.textContent?.trim())
    expect(labels).toEqual(['This computer', 'srv2056164', 'build-box'])
    expect(buttonWithText(container, 'This computer')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('never offers the picker on the GitHub page', async () => {
    seedHosts({ ssh: true })
    const container = await mount('github')
    expect(container.querySelector('[role="group"]')).toBeNull()
  })

  it('shows the SSH host status and sends every action to that host, not this computer', async () => {
    seedHosts({ ssh: true })
    const container = await mount('engram')
    await clickButton(container, 'build-box')
    expect(mocks.remoteListApps).toHaveBeenCalledWith({ connectionId: 'ssh-1' })
    expect(container.textContent).toContain('9.9.9-remote')
    expect(container.textContent).toContain('Engram on build-box')
    expect(container.textContent).not.toContain('0.1.0-local')

    await clickButton(container, 'Connect')
    expect(mocks.remoteConnect).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      args: { id: 'engram' }
    })
    expect(mocks.localConnect).not.toHaveBeenCalled()
    // The page re-reads the chosen host after a change.
    expect(mocks.remoteListApps).toHaveBeenCalledTimes(2)
  })

  it('routes back to this computer when it is picked again', async () => {
    seedHosts({ ssh: true })
    const container = await mount('engram')
    await clickButton(container, 'build-box')
    await clickButton(container, 'This computer')
    expect(container.textContent).toContain('0.1.0-local')
    await clickButton(container, 'Connect')
    expect(mocks.localConnect).toHaveBeenCalledWith({ id: 'engram' })
    expect(mocks.remoteConnect).not.toHaveBeenCalled()
  })

  it('tells the person to update an older SSH host instead of showing its apps', async () => {
    seedHosts({ ssh: true })
    mocks.remoteListApps.mockResolvedValue({ ok: false, reason: 'host-needs-update' })
    const container = await mount('engram')
    await clickButton(container, 'build-box')
    expect(container.textContent).toContain('Update MassOrca on build-box first.')
    expect(container.querySelector('[data-marketplace-section="connection"]')).toBeNull()
  })

  it('calls the paired server through its own RPC methods', async () => {
    seedHosts({ runtime: true })
    mocks.callRuntimeRpc.mockImplementation(async (_target: unknown, method: string) =>
      method === 'marketplace.apps.list'
        ? { ok: true, apps: [remoteEngram], token: 'dropped' }
        : { ok: true, status: engramStatus(true, '9.9.9-remote') }
    )
    const container = await mount('engram')
    await clickButton(container, 'srv2056164')
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.apps.list',
      {},
      expect.anything()
    )
    expect(container.textContent).toContain('9.9.9-remote')
    await clickButton(container, 'Connect')
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.apps.connect',
      { id: 'engram' },
      expect.anything()
    )
    expect(mocks.localConnect).not.toHaveBeenCalled()
  })

  it('reads a paired server without the methods as needing an update', async () => {
    seedHosts({ runtime: true })
    mocks.callRuntimeRpc.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'method_not_found' })
    )
    const container = await mount('engram')
    await clickButton(container, 'srv2056164')
    expect(container.textContent).toContain('Update MassOrca on srv2056164 first.')
  })
})
