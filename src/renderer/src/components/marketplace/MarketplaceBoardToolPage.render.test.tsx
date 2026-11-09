// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogRow } from './MarketplaceCatalogRows'
import type { MarketplaceAppHost } from './use-marketplace-app-host'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  hostKey: null as string | null,
  readStatus: vi.fn(),
  runAction: vi.fn()
}))

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('./use-marketplace-app-host', () => ({
  useMarketplaceAppHost: (): MarketplaceAppHost => ({
    targets: [{ kind: 'runtime', environmentId: 'env-1', label: 'VPS' }],
    selectedKey: mocks.hostKey,
    select: () => undefined,
    apps: { status: 'ready', apps: [] },
    failure: null,
    scope: null,
    wslDistro: null,
    retry: () => undefined
  })
}))
vi.mock('./marketplace-host-program-client', () => ({
  readHostProgramStatus: (...args: unknown[]) => mocks.readStatus(...args),
  runHostProgramAction: (...args: unknown[]) => mocks.runAction(...args)
}))

const { createTestStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MarketplaceBoardToolPage } = await import('./MarketplaceBoardToolPage')

function row(id: 'gh' | 'node'): CatalogRow {
  return {
    key: `board-${id}`,
    section: 'tools',
    name: id === 'gh' ? 'GitHub CLI' : 'Node.js',
    description: '',
    icon: { kind: 'skill' },
    status: { kind: 'pending', label: 'Not installed' },
    target: { kind: 'board-tool', id },
    owned: false,
    service: false,
    customId: null
  }
}

const MISSING = {
  ok: true,
  installed: false,
  canInstall: true,
  canUninstall: false,
  installCommand: 'winget install --id GitHub.cli -e'
}
const INSTALLED = {
  ok: true,
  installed: true,
  method: 'winget',
  version: 'gh 2.60',
  canInstall: false,
  canUninstall: true,
  uninstallCommand: 'winget uninstall --id GitHub.cli -e'
}

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(id: 'gh' | 'node'): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root?.render(
      <TooltipProvider>
        <MarketplaceBoardToolPage row={row(id)} onBack={() => undefined} />
      </TooltipProvider>
    )
  )
  await act(async () => {})
  return container
}

function button(scope: ParentNode, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!found) {
    throw new Error(`Missing button ${text}`)
  }
  return found
}

beforeEach(() => {
  mocks.hostKey = null
  mocks.readStatus.mockReset().mockResolvedValue(MISSING)
  mocks.runAction.mockReset().mockResolvedValue({ ok: true })
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
})

describe('MarketplaceBoardToolPage install and uninstall', () => {
  it('installs GitHub CLI on the picked host and says the host does not have it', async () => {
    mocks.hostKey = 'runtime:env-1'
    const page = await render('gh')
    expect(mocks.readStatus).toHaveBeenCalledWith('gh', 'runtime:env-1')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Not installed on VPS'
    )
    await act(async () => button(page, 'Install').click())
    expect(mocks.runAction).toHaveBeenCalledWith('install', 'gh', 'runtime:env-1')
    expect(page.textContent).not.toContain('MassOrca cannot install')
  })

  it('shows Node.js as installed with Uninstall in the Danger zone, after a confirm', async () => {
    mocks.readStatus.mockResolvedValue({ ...INSTALLED, version: 'node 22' })
    const page = await render('node')
    expect(mocks.readStatus).toHaveBeenCalledWith('node', 'local')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toContain(
      'Installed on'
    )
    const danger = page.querySelector('[data-marketplace-section="danger"]') as HTMLElement
    await act(async () => button(danger, 'Uninstall').click())
    expect(mocks.runAction).not.toHaveBeenCalled()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Uninstall Node.js from')
    await act(async () => button(dialog, 'Uninstall').click())
    expect(mocks.runAction).toHaveBeenCalledWith('uninstall', 'node', 'local')
  })

  it('keeps every other section of the page', async () => {
    const page = await render('gh')
    for (const id of ['connection', 'advanced', 'danger']) {
      expect(page.querySelector(`[data-marketplace-section="${id}"]`)).not.toBeNull()
    }
    expect(page.querySelector('[data-marketplace-note="banner"]')).not.toBeNull()
    expect(page.textContent).toContain('GitHub CLI signs in with gh auth login')
  })
})
