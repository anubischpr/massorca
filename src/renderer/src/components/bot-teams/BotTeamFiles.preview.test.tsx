/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { useBotTeamSeenFilesStore } from './bot-team-file-read-state'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamFiles = vi.hoisted(() => vi.fn())
const readBotTeamFile = vi.hoisted(() => vi.fn())
const listBotTeamVersions = vi.hoisted(() => vi.fn())
const listBotTeamFileVersions = vi.hoisted(() => vi.fn())
const readBotTeamVersionFile = vi.hoisted(() => vi.fn())
const readBotTeamFilePreview = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamFiles,
  readBotTeamFile,
  listBotTeamVersions,
  listBotTeamFileVersions,
  readBotTeamVersionFile,
  restoreBotTeamFileVersion: vi.fn()
}))
vi.mock('./bot-team-file-preview-read', () => ({ readBotTeamFilePreview }))
vi.mock('@/runtime/runtime-bot-team-client-project-files', () => ({
  listBotTeamProjectFiles: vi.fn(async () => 'unavailable'),
  readBotTeamProjectFile: vi.fn(),
  readBotTeamProjectFilePreview: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

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

const mounted: { container: HTMLDivElement; root: Root }[] = []

beforeEach(() => {
  localStorage.clear()
  useBotTeamSeenFilesStore.setState({ seen: {} })
  listBotTeamVersions.mockResolvedValue('unavailable')
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamFiles team={TEAM} />))
  return container
}

function rowFor(container: HTMLElement, name: string): HTMLButtonElement {
  const row = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(name)
  )
  if (!row) {
    throw new Error(`no row for ${name}`)
  }
  return row
}

describe('the Files of a team', () => {
  it('does not list tool folders or dot files', async () => {
    listBotTeamFiles.mockResolvedValue({
      files: [
        { relativePath: '.atl/skill-registry.md', basename: 'skill-registry.md', kind: 'text' },
        { relativePath: '.gitignore', basename: '.gitignore', kind: 'text' },
        {
          relativePath: 'docs/presentacion/nexuscare-features-deck.html',
          basename: 'nexuscare-features-deck.html',
          kind: 'text'
        }
      ],
      truncated: false
    })

    const container = await mount()

    expect(container.textContent).toContain('docs/presentacion/nexuscare-features-deck.html')
    expect(container.textContent).not.toContain('.atl')
    expect(container.textContent).not.toContain('.gitignore')
  })

  it('opens a picture from the team folder instead of refusing it', async () => {
    listBotTeamFiles.mockResolvedValue({
      files: [{ relativePath: 'logo.png', basename: 'logo.png', kind: 'binary' }],
      truncated: false
    })
    readBotTeamFilePreview.mockResolvedValue({
      content: 'AAAA',
      isBinary: true,
      isImage: true,
      mimeType: 'image/png'
    })
    const container = await mount()

    await act(async () => rowFor(container, 'logo.png').click())

    expect(readBotTeamFilePreview).toHaveBeenCalledWith('t1', 'logo.png')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('opens a page of the team folder in a view that takes the pane height', async () => {
    listBotTeamFiles.mockResolvedValue({
      files: [{ relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' }],
      truncated: false
    })
    readBotTeamFile.mockResolvedValue({ content: '<p>Summer</p>' })
    const container = await mount()

    await act(async () => rowFor(container, 'flyer.html').click())

    expect((container.firstElementChild as HTMLElement).className).toContain('h-full')
  })

  it('marks a file that arrived after the first listing, until the person opens it', async () => {
    useBotTeamSeenFilesStore.setState({ seen: { t1: ['team:flyer.html'] } })
    listBotTeamFiles.mockResolvedValue({
      files: [
        { relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' },
        { relativePath: 'deck.html', basename: 'deck.html', kind: 'text' }
      ],
      truncated: false
    })
    readBotTeamFile.mockResolvedValue({ content: '<p>Deck</p>', truncated: false, byteLength: 12 })
    const container = await mount()

    expect(container.querySelectorAll('[aria-label="New file"]')).toHaveLength(1)
    expect(rowFor(container, 'deck.html').querySelector('[aria-label="New file"]')).not.toBeNull()

    await act(async () => rowFor(container, 'deck.html').click())

    expect(useBotTeamSeenFilesStore.getState().seen.t1).toContain('team:deck.html')
  })
})
