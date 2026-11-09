// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { MarketplaceBadgeState } from './marketplace-status'
import type { MarketplaceCatalogItem } from './marketplace-catalog'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(
  (): {
    host: MarketplaceAppHost | undefined
    gitStatus: unknown
    recheck: Mock
    runAction: Mock
  } => ({
    host: undefined,
    gitStatus: null,
    recheck: vi.fn(),
    runAction: vi.fn()
  })
)

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
    recheck: mocks.recheck
  })
}))
vi.mock('./marketplace-host-program-client', () => ({
  readHostProgramStatus: () => Promise.resolve(mocks.gitStatus),
  runHostProgramAction: (...args: unknown[]) => mocks.runAction(...args)
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
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
// Why: Git's host-program status on the host the page reads, as the program RPC reports it.
const GIT_MISSING = {
  ok: true,
  installed: false,
  canInstall: true,
  canUninstall: false,
  installCommand: 'brew install git'
}
const GIT_INSTALLED = {
  ok: true,
  installed: true,
  method: 'apt',
  version: 'git version 2.43',
  canInstall: false,
  canUninstall: true,
  uninstallCommand: 'sudo apt-get remove -y git'
}

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

async function mount(
  badgeState: MarketplaceBadgeState,
  item: MarketplaceCatalogItem | undefined = gitItem
): Promise<HTMLDivElement> {
  if (!item) {
    throw new Error('Git is missing from the Marketplace catalog')
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(
      <TooltipProvider>
        <MarketplaceDetail item={item} badgeState={badgeState} onBack={() => {}} />
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

/** The page's Danger zone: the Uninstall for its host program, or the note that says why there is none. */
function dangerZone(scope: ParentNode): HTMLElement {
  const zone = scope.querySelector<HTMLElement>('[data-marketplace-section="danger"]')
  if (!zone) {
    throw new Error('Missing the Danger zone')
  }
  return zone
}

describe('MarketplaceDetail Danger zone', () => {
  beforeEach(() => {
    mocks.host = hostOf(false)
    mocks.gitStatus = GIT_MISSING
    mocks.recheck.mockReset()
    mocks.runAction.mockReset().mockResolvedValue({ ok: true })
    seedStore(store, { marketplaceHostKey: null })
  })

  it('uninstalls Git from the Danger zone once it is installed on this computer', async () => {
    mocks.gitStatus = GIT_INSTALLED
    const container = await mount('installed')
    const uninstall = buttonWithText(dangerZone(container), 'Uninstall')
    expect(uninstall).toBeDefined()
    await act(async () => uninstall?.click())
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Uninstall Git from This computer?')
    const confirm = dialog ? buttonWithText(dialog, 'Uninstall') : undefined
    await act(async () => confirm?.click())
    expect(mocks.runAction).toHaveBeenCalledWith('uninstall', 'git', 'local')
    expect(mocks.recheck).toHaveBeenCalled()
  })

  it('says why the Danger zone has no Uninstall while Git is missing here', async () => {
    const container = await mount('not-installed')
    expect(dangerZone(container).textContent).toContain('Git is not installed on This computer.')
    expect(buttonWithText(dangerZone(container), 'Uninstall')).toBeUndefined()
  })

  it('uninstalls Git on the picked host from the same Danger zone', async () => {
    mocks.host = hostOf(true)
    seedStore(store, { marketplaceHostKey: 'runtime:env-1' })
    mocks.gitStatus = GIT_INSTALLED
    const container = await mount('installed')
    const uninstall = buttonWithText(dangerZone(container), 'Uninstall')
    expect(uninstall).toBeDefined()
    await act(async () => uninstall?.click())
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Uninstall Git from srv2056164?')
    const confirm = dialog ? buttonWithText(dialog, 'Uninstall') : undefined
    await act(async () => confirm?.click())
    expect(mocks.runAction).toHaveBeenCalledWith('uninstall', 'git', 'runtime:env-1')
  })

  it('keeps the does-not-remove note for an item with no host program', async () => {
    const engram = MARKETPLACE_CATALOG.find((item) => item.id === 'engram')
    if (!engram) {
      throw new Error('Engram is missing from the Marketplace catalog')
    }
    const container = await mount('not-installed', engram)
    expect(dangerZone(container).textContent).toContain(`MassOrca does not remove ${engram.name}.`)
  })
})
