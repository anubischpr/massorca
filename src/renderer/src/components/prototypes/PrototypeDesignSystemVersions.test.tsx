// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DesignSystemVersionListed,
  PrototypeListedDesignSystem
} from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeDesignSystemScreen } from './PrototypeDesignSystemScreen'
import { usePrototypeViewStore } from './prototype-view-store'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? '')),
  getIntlLocale: () => 'en-GB'
}))

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  list: vi.fn(),
  readVersion: vi.fn(),
  restore: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() })
}))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../runtime/runtime-prototype-client', () => ({
  readDesignSystemOnHost: mocks.read,
  listDesignSystemVersionsOnHost: mocks.list,
  readDesignSystemVersionOnHost: mocks.readVersion,
  restoreDesignSystemVersionOnHost: mocks.restore
}))
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => ({ kind: 'local' }),
  worktreeIdOfChatSession: () => 'wt-1'
}))
vi.mock('../native-chat/use-native-chat-external-attachments', () => ({
  useNativeChatExternalAttachments: () => ({ attachExternalPaths: () => undefined })
}))

const CURRENT_TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 4, status: 'detected', agent: 'Codex' } }
})
const V3_TOKENS = JSON.stringify({
  color: { primary: { $value: '#dc2626' } },
  $extensions: { massorca: { version: 3, status: 'detected', agent: 'Codex' } }
})

// Today and yesterday, as the host would stamp them.
const TODAY_AM = new Date()
TODAY_AM.setHours(11, 20, 0, 0)
const TODAY_PM = new Date()
TODAY_PM.setHours(14, 5, 0, 0)
const YESTERDAY = new Date()
YESTERDAY.setDate(YESTERDAY.getDate() - 1)

const LISTED: DesignSystemVersionListed[] = [
  { version: 4, at: TODAY_PM.toISOString(), saved: true, current: true },
  { version: 3, at: TODAY_AM.toISOString(), saved: true, current: false },
  { version: 2, at: YESTERDAY.toISOString(), saved: false, current: false },
  { version: 1, saved: false, current: false }
]

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: 'nexus',
  projectName: 'nexuscare',
  status: 'detected',
  version: 4,
  tokenCount: 1,
  agent: 'Codex',
  swatches: ['#2563eb'],
  newestRequest: { requestId: 'r-newest', sessionId: 'newest-chat', agent: 'claude' as const }
}

function readOk(tokensJson: string): unknown {
  return {
    ok: true,
    projectKey: 'nexus',
    projectName: 'nexuscare',
    fileNames: ['design/system/tokens.json'],
    tokensJson
  }
}

function rowOf(label: string): HTMLElement {
  const row = screen.getByText(label).parentElement?.parentElement
  if (row === null || row === undefined) {
    throw new Error(`no row around ${label}`)
  }
  return row
}

function renderScreen(onRestored = vi.fn()): void {
  render(
    <PrototypeDesignSystemScreen
      system={SYSTEM}
      sets={[]}
      sendText={vi.fn()}
      onRestored={onRestored}
    />
  )
}

async function openVersions(): Promise<void> {
  await screen.findByText('Anything else')
  fireEvent.click(await screen.findByRole('button', { name: 'Versions' }))
  await screen.findByText('Versions of the design system')
}

beforeEach(() => {
  mocks.read.mockReset()
  mocks.list.mockReset()
  mocks.readVersion.mockReset()
  mocks.restore.mockReset()
  mocks.toast.error.mockReset()
  mocks.read.mockResolvedValue(readOk(CURRENT_TOKENS))
  mocks.readVersion.mockImplementation((_target: unknown, params: { version: number }) =>
    Promise.resolve(readOk(params.version === 3 ? V3_TOKENS : CURRENT_TOKENS))
  )
  mocks.list.mockResolvedValue({ ok: true, versions: LISTED })
  usePrototypeViewStore.setState({ designSystemViews: {}, designSystemVersionViews: {} })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { shell: { pickAttachments: () => Promise.resolve([]) } }
  })
})

afterEach(cleanup)

describe('PrototypeDesignSystemScreen Versions', () => {
  it('swaps the aside between the Draft and the Versions list with the Versions button', async () => {
    renderScreen()
    await openVersions()
    expect(screen.queryByText('Anything else')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Versions' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('data-state', 'on')
    fireEvent.click(toggle)
    expect(await screen.findByText('Anything else')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('data-state', 'off')
    expect(screen.queryByText('Versions of the design system')).not.toBeInTheDocument()
  })

  it('lists the current version with no buttons, saved earlier ones with Preview and Restore, and unsaved ones with none', async () => {
    renderScreen()
    await openVersions()
    expect(within(rowOf('Current · v4')).queryAllByRole('button')).toHaveLength(0)
    const saved = rowOf('v3')
    expect(within(saved).getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    expect(within(saved).getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    for (const label of ['v2', 'v1']) {
      const unsaved = rowOf(label)
      expect(within(unsaved).queryAllByRole('button')).toHaveLength(0)
      expect(within(unsaved).getByText(/not saved/u)).toBeInTheDocument()
    }
  })

  it('previews an earlier version read-only with its banner, and Back to current returns', async () => {
    renderScreen()
    await openVersions()
    fireEvent.click(within(rowOf('v3')).getByRole('button', { name: 'Preview' }))
    expect(
      await screen.findByText(
        'Viewing v3 · read-only. Tokens, Components and Source show that version.'
      )
    ).toBeInTheDocument()
    expect(mocks.readVersion).toHaveBeenCalledWith(
      { kind: 'local' },
      { sessionId: 'newest-chat', version: 3 }
    )
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Tokens' }))
    expect(await screen.findByText('#dc2626')).toBeInTheDocument()
    expect(document.querySelector('[inert]')).not.toBeNull()
    // The read-only version still scrolls: the scroller is never inert, only what it holds.
    const scroller = screen.getByTestId('design-system-scroll')
    expect(scroller).not.toHaveAttribute('inert')
    expect(scroller.closest('[inert]')).toBeNull()
    expect(scroller.querySelector('[inert]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Restore as v5' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to current' }))
    await waitFor(() => expect(screen.queryByText(/Viewing v3/u)).not.toBeInTheDocument())
    expect(await screen.findByText('#2563eb')).toBeInTheDocument()
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('asks before restoring with the exact confirm text, then restores that version and asks the page to reload', async () => {
    mocks.restore.mockResolvedValue({ ok: true, version: 5 })
    const onRestored = vi.fn()
    renderScreen(onRestored)
    await openVersions()
    fireEvent.click(within(rowOf('v3')).getByRole('button', { name: 'Restore' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Restore version 3?')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'It becomes version 5, the current one, with the content of v3. Versions 1 to 4 stay in the list.'
      )
    ).toBeInTheDocument()
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1))
    expect(mocks.restore).toHaveBeenCalledWith(
      { kind: 'local' },
      { sessionId: 'newest-chat', version: 3 }
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error and keeps the dialog and the preview when the host refuses the restore', async () => {
    mocks.restore.mockResolvedValue({ ok: false, error: 'unwritable' })
    const onRestored = vi.fn()
    renderScreen(onRestored)
    await openVersions()
    fireEvent.click(within(rowOf('v3')).getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore as v5' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't restore this version. Try again.")
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Viewing v3/u)).toBeInTheDocument()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('hides the Versions button when the host has no versions method, and keeps the Draft', async () => {
    mocks.list.mockRejectedValue(
      Object.assign(new Error('Unknown method'), { code: 'method_not_found' })
    )
    renderScreen()
    await screen.findByText('Anything else')
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1))
    await act(() => Promise.resolve())
    expect(screen.queryByRole('button', { name: 'Versions' })).not.toBeInTheDocument()
    expect(screen.getByText('Anything else')).toBeInTheDocument()
  })
})
