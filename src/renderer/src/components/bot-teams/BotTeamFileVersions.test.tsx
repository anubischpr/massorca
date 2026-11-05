/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const readBotTeamFile = vi.hoisted(() => vi.fn())
const listBotTeamFileVersions = vi.hoisted(() => vi.fn())
const readBotTeamVersionFile = vi.hoisted(() => vi.fn())
const restoreBotTeamFileVersion = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  readBotTeamFile,
  listBotTeamFileVersions,
  readBotTeamVersionFile,
  restoreBotTeamFileVersion
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast }))

const { BotTeamFileVersions } = await import('./BotTeamFileVersions')

const version = (id: string, label: string, author: string | null) => ({
  id,
  commit: `c${id}`,
  tree: `t${id}`,
  createdAt: Date.UTC(2026, 10, 1, 12, Number(id)),
  reason: 'task-finished' as const,
  label,
  skipped: 0,
  author
})
const NEWEST = version('3', 'Price list', 'Nora')
const MIDDLE = version('2', 'Text only', 'Nora')
const FIRST = version('1', 'First layout', 'Iris')

const mounted: { container: HTMLDivElement; root: Root }[] = []
const onRestored = vi.fn()

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamFileVersions
        teamId="t1"
        relativePath="flyer.html"
        onBack={() => {}}
        onRestored={onRestored}
      />
    )
  )
  return container
}

const button = (container: ParentNode, label: string, nth = 0): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].filter(
    (entry) => entry.textContent?.trim() === label || entry.getAttribute('aria-label') === label
  )[nth]
  if (!found) {
    throw new Error(`Button ${label} missing`)
  }
  return found
}

beforeEach(() => {
  document.body.innerHTML = ''
  readBotTeamFile.mockReset()
  readBotTeamFile.mockResolvedValue({ content: 'Offers\nAsk your sales contact\nPrice\n' })
  listBotTeamFileVersions.mockReset()
  listBotTeamFileVersions.mockResolvedValue([
    { version: NEWEST, deleted: false },
    { version: MIDDLE, deleted: false },
    { version: FIRST, deleted: false }
  ])
  readBotTeamVersionFile.mockReset()
  readBotTeamVersionFile.mockImplementation(async (_team: string, id: string) =>
    id === '3'
      ? { kind: 'text', text: 'Offers\nAsk your sales contact\nPrice\n' }
      : { kind: 'text', text: 'Offers\nPrice\nValid until\n' }
  )
  restoreBotTeamFileVersion.mockReset()
  restoreBotTeamFileVersion.mockResolvedValue({
    ok: true,
    restoredFrom: FIRST,
    savedBefore: null
  })
  toast.mockReset()
  toast.error.mockReset()
  onRestored.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the versions of a file', () => {
  it('shows Current as the newest version while nothing changed, then the earlier ones', async () => {
    const container = await mount()
    const text = container.textContent ?? ''
    expect(text).toContain('Versions')
    expect(text).toMatch(/CurrentNora, /)
    expect(text).toContain('Text only')
    expect(text).toContain('First layout')
    // The newest version is Current, so it is not listed a second time.
    expect(text).not.toContain('Price list')
    expect(container.querySelectorAll('button')).toBeDefined()
  })

  it('names no one on Current when the file changed after its last version', async () => {
    readBotTeamFile.mockResolvedValue({ content: 'edited since' })
    const container = await mount()
    expect(container.textContent).not.toMatch(/CurrentNora/)
    expect(container.textContent).toContain('Price list')
  })

  it('leaves out a version in which the file was deleted', async () => {
    listBotTeamFileVersions.mockResolvedValue([
      { version: NEWEST, deleted: true },
      { version: FIRST, deleted: false }
    ])
    const container = await mount()
    expect(container.textContent).not.toContain('Price list')
    expect(container.textContent).toContain('First layout')
  })

  it('asks first, and restores only when confirmed', async () => {
    const container = await mount()
    await act(async () => button(container, 'Restore', 0).click())
    expect(document.body.textContent).toContain('Restore this version?')
    expect(document.body.textContent).toContain(
      'The current version stays in the list, so you can go back to it.'
    )
    expect(restoreBotTeamFileVersion).not.toHaveBeenCalled()

    await act(async () => button(document.body, 'Cancel').click())
    expect(restoreBotTeamFileVersion).not.toHaveBeenCalled()

    await act(async () => button(container, 'Restore', 0).click())
    await act(async () => button(document.body, 'Restore', 2).click())
    expect(restoreBotTeamFileVersion).toHaveBeenCalledWith('t1', '2', 'flyer.html')
    expect(toast).toHaveBeenCalledWith('Version restored')
    expect(onRestored).toHaveBeenCalled()
  })

  it('reports a restore the host refused and keeps the dialog', async () => {
    restoreBotTeamFileVersion.mockResolvedValue({
      ok: false,
      reason: 'too-large',
      message: 'This folder is too large to save as a version.'
    })
    const container = await mount()
    await act(async () => button(container, 'Restore', 0).click())
    await act(async () => button(document.body, 'Restore', 2).click())
    expect(toast.error).toHaveBeenCalledWith('This folder is too large to save as a version.')
    expect(onRestored).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Restore this version?')
  })
})

describe('comparing a version with the current file', () => {
  async function openCompare(): Promise<HTMLDivElement> {
    const container = await mount()
    await act(async () => button(container, 'Compare', 0).click())
    return container
  }

  it('counts the changes, marks them and steps from one to the next', async () => {
    const container = await openCompare()
    const text = container.textContent ?? ''
    expect(text).toContain('Two changes')
    expect(text).toContain('Change one of two')
    expect(text).toContain('Added')
    expect(text).toContain('Removed')
    expect(text).toContain('Current')

    await act(async () => button(container, 'Next change').click())
    expect(container.textContent).toContain('Change two of two')
    await act(async () => button(container, 'Next change').click())
    expect(container.textContent).toContain('Change one of two')
    await act(async () => button(container, 'Previous change').click())
    expect(container.textContent).toContain('Change two of two')
  })

  it('can show only the changes', async () => {
    const container = await openCompare()
    expect(container.textContent).toContain('Offers')
    await act(async () => button(container, 'Show only changes').click())
    expect(container.textContent).not.toContain('Offers')
    expect(container.textContent).toContain('Valid until')
  })

  it('says a binary version by its size instead of comparing lines', async () => {
    readBotTeamVersionFile.mockResolvedValue({ kind: 'binary', size: 1048576 })
    const container = await openCompare()
    expect(container.textContent).toContain('Binary file. This version is 1.0 MB.')
    expect(container.textContent).not.toContain('Change one of')
  })

  it('goes back to the versions, and restores after the same confirmation', async () => {
    const container = await openCompare()
    await act(async () => button(container, 'Restore this version').click())
    expect(document.body.textContent).toContain('Restore this version?')
    await act(async () => button(document.body, 'Restore', 0).click())
    expect(restoreBotTeamFileVersion).toHaveBeenCalledWith('t1', '2', 'flyer.html')
    // After a restore the screen is the list again, as on the design.
    expect(container.textContent).toContain('Versions')
  })

  it('cycles through the versions from the version chip', async () => {
    const container = await openCompare()
    expect(container.textContent).toContain('Text only, Nora')
    const chip = [...container.querySelectorAll('button')].find((entry) =>
      entry.textContent?.startsWith('Text only, Nora')
    )
    await act(async () => chip?.click())
    expect(container.textContent).toContain('First layout, Iris')
  })

  it('lets a page fill the area left of the versions instead of a fixed box', async () => {
    const container = await mount()
    const frame = container.querySelector('iframe')
    const scroller = frame?.closest('.overflow-y-auto')

    expect(frame?.className).toContain('size-full')
    expect(frame?.getAttribute('style') ?? '').not.toMatch(/width|height/)
    // A flex column gives the frame's flex-1 wrapper a definite height to fill.
    expect(scroller?.className).toContain('flex')
    expect(scroller?.className).toContain('flex-col')
  })
})
