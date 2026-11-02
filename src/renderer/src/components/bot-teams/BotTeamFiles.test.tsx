/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamFiles = vi.hoisted(() => vi.fn())
const readBotTeamFile = vi.hoisted(() => vi.fn())
const listBotTeamVersions = vi.hoisted(() => vi.fn())
const listBotTeamFileVersions = vi.hoisted(() => vi.fn())
const readBotTeamVersionFile = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamFiles,
  readBotTeamFile,
  listBotTeamVersions,
  listBotTeamFileVersions,
  readBotTeamVersionFile,
  restoreBotTeamFileVersion: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const { BotTeamFiles } = await import('./BotTeamFiles')

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

const LIST = {
  files: [
    { relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' as const },
    { relativePath: 'brand/notes.md', basename: 'notes.md', kind: 'text' as const },
    { relativePath: 'logo.png', basename: 'logo.png', kind: 'binary' as const }
  ],
  truncated: false
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamFiles team={TEAM} />))
  return container
}

const fileButton = (container: ParentNode, name: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(name)
  )
  if (!found) {
    throw new Error(`File ${name} missing`)
  }
  return found
}

beforeEach(() => {
  document.body.innerHTML = ''
  listBotTeamFiles.mockReset()
  listBotTeamFiles.mockResolvedValue(LIST)
  readBotTeamFile.mockReset()
  listBotTeamVersions.mockReset()
  listBotTeamVersions.mockResolvedValue('unavailable')
  listBotTeamFileVersions.mockReset()
  listBotTeamFileVersions.mockResolvedValue([])
  readBotTeamVersionFile.mockReset()
  readBotTeamVersionFile.mockResolvedValue({ kind: 'text', text: '<p>Summer</p>' })
  toastError.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the team files', () => {
  it('lists the files of the team folder under the Files title, with the design’s note', async () => {
    const container = await mount()
    expect(listBotTeamFiles).toHaveBeenCalledWith('t1')
    expect(container.textContent).toContain('Files')
    for (const path of ['flyer.html', 'brand/notes.md', 'logo.png']) {
      expect(container.textContent).toContain(path)
    }
  })

  const NOTE = 'One bot or person edits a file at a time. Every change is saved as a version.'
  const VERSION = {
    id: '000002',
    commit: 'c2',
    tree: 't2',
    createdAt: Date.UTC(2026, 10, 1, 12, 0),
    reason: 'task-finished' as const,
    label: 'Flyer for June',
    skipped: 0,
    author: 'Iris'
  }

  it('does not say changes are saved as versions until the host has saved one', async () => {
    for (const state of [
      'unavailable',
      { git: 'unavailable' },
      { git: 'ok', versions: [], lastVersionOfFile: {} }
    ]) {
      listBotTeamVersions.mockResolvedValue(state)
      const container = await mount()
      expect(container.textContent).not.toContain('saved as a version')
    }
  })

  it('says it, and who changed a file and when, only once versions exist', async () => {
    listBotTeamVersions.mockResolvedValue({
      git: 'ok',
      versions: [VERSION, { ...VERSION, id: '000001', author: null, reason: 'other' }],
      lastVersionOfFile: { 'flyer.html': '000002', 'brand/notes.md': '000001' }
    })
    const container = await mount()
    expect(container.textContent).toContain(NOTE)
    expect(fileButton(container, 'flyer.html').textContent).toMatch(/Changed by Iris, .+/)
    // No one was recorded for this file's last version, and logo.png has none at all.
    expect(fileButton(container, 'notes.md').textContent).not.toContain('Changed by')
    expect(fileButton(container, 'logo.png').textContent).not.toContain('Changed by')
  })

  it('opens a file on its versions when the host keeps them', async () => {
    listBotTeamVersions.mockResolvedValue({
      git: 'ok',
      versions: [VERSION],
      lastVersionOfFile: { 'flyer.html': '000002' }
    })
    listBotTeamFileVersions.mockResolvedValue([{ version: VERSION, deleted: false }])
    readBotTeamFile.mockResolvedValue({ content: '<p>Summer</p>', truncated: false })
    const container = await mount()
    await act(async () => fileButton(container, 'flyer.html').click())
    expect(listBotTeamFileVersions).toHaveBeenCalledWith('t1', 'flyer.html')
    expect(container.textContent).toContain('Versions')
    expect(container.textContent).toContain('<p>Summer</p>')
  })

  it('opens a file read-only, and goes back to the list', async () => {
    readBotTeamFile.mockResolvedValue({ content: '<p>Summer</p>', truncated: false })
    const container = await mount()

    await act(async () => fileButton(container, 'flyer.html').click())

    expect(readBotTeamFile).toHaveBeenCalledWith('t1', 'flyer.html')
    expect(container.textContent).toContain('<p>Summer</p>')
    expect(container.querySelector('textarea, input')).toBeNull()

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Back to files"]')?.click()
    )
    expect(container.textContent).toContain('brand/notes.md')
  })

  it('does not open a file it cannot show as text', async () => {
    const container = await mount()
    expect(fileButton(container, 'logo.png').disabled).toBe(true)
  })

  it('says so when the team has no files yet', async () => {
    listBotTeamFiles.mockResolvedValue({ files: [], truncated: false })
    const container = await mount()
    expect(container.textContent).toContain('Nothing here yet.')
  })

  it('shows no list, and no error, on a host that cannot list team files', async () => {
    listBotTeamFiles.mockResolvedValue('unavailable')
    const container = await mount()
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(toastError).not.toHaveBeenCalled()
  })
})
