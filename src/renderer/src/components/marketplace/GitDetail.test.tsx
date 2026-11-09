// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { GitInstallView } from './GitInstallState'
import type { MarketplaceBadgeState } from './marketplace-status'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(
  (): { view: GitInstallView; recheck: Mock; readStatus: Mock; runAction: Mock } => ({
    view: { kind: 'checking' },
    recheck: vi.fn(),
    readStatus: vi.fn(),
    runAction: vi.fn()
  })
)

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('./GitInstallController', () => ({
  useGitInstallController: () => ({
    view: mocks.view,
    install: () => undefined,
    adopt: () => undefined,
    recheck: mocks.recheck
  })
}))
vi.mock('./marketplace-host-program-client', () => ({
  readHostProgramStatus: (...args: unknown[]) => mocks.readStatus(...args),
  runHostProgramAction: (...args: unknown[]) => mocks.runAction(...args)
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { GitDetail, useGitDetailControls } = await import('./GitDetail')

const MISSING = {
  ok: true,
  installed: false,
  canInstall: true,
  canUninstall: false,
  installCommand: 'apt-get install -y git'
}
const INSTALLED = {
  ok: true,
  installed: true,
  method: 'apt',
  version: 'git version 2.43',
  canInstall: false,
  canUninstall: true,
  uninstallCommand: 'sudo apt-get remove -y git'
}

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(element: React.ReactElement): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(element))
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

function hasButton(scope: ParentNode, text: string): boolean {
  return [...scope.querySelectorAll('button')].some((b) => b.textContent?.trim() === text)
}

/** The Git card with the controls its page mounts; the Danger zone's Uninstall is tested on the page. */
function GitCard({ state, hostLabel }: { state: MarketplaceBadgeState; hostLabel: string | null }) {
  const controls = useGitDetailControls(hostLabel)
  return <GitDetail state={state} hostLabel={hostLabel} controls={controls} />
}

beforeEach(() => {
  mocks.view = { kind: 'checking' }
  mocks.recheck.mockReset()
  mocks.readStatus.mockReset().mockResolvedValue(MISSING)
  mocks.runAction.mockReset().mockResolvedValue({ ok: true })
  seedStore(store, { marketplaceHostKey: 'ssh:box' })
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
})

describe('GitDetail on a picked host', () => {
  it('installs Git on that host instead of saying it is not available yet', async () => {
    const page = await render(<GitCard state="not-installed" hostLabel="box" />)
    expect(page.textContent).not.toContain('not available yet')
    expect(mocks.readStatus).toHaveBeenCalledWith('git', 'ssh:box')
    await act(async () => button(page, 'Install').click())
    expect(mocks.runAction).toHaveBeenCalledWith('install', 'git', 'ssh:box')
  })

  it('says Git is installed there and leaves Uninstall to the Danger zone', async () => {
    mocks.readStatus.mockResolvedValue(INSTALLED)
    const page = await render(<GitCard state="installed" hostLabel="box" />)
    expect(page.textContent).toContain('Git is installed on box.')
    expect(hasButton(page, 'Uninstall')).toBe(false)
  })
})

describe('GitDetail on this computer', () => {
  it('keeps the install board and leaves Uninstall to the Danger zone', async () => {
    mocks.view = { kind: 'installed', version: '2.50', path: '/usr/bin/git' }
    mocks.readStatus.mockResolvedValue(INSTALLED)
    const page = await render(<GitCard state="installed" hostLabel={null} />)
    expect(mocks.readStatus).toHaveBeenCalledWith('git', 'local')
    expect(hasButton(page, 'Uninstall')).toBe(false)
  })

  it('offers no Uninstall while Git is missing', async () => {
    mocks.view = { kind: 'checking' }
    const page = await render(<GitCard state="not-installed" hostLabel={null} />)
    expect(hasButton(page, 'Uninstall')).toBe(false)
  })
})
