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
const listBotTeamProjectFiles = vi.hoisted(() => vi.fn())
const readBotTeamProjectFile = vi.hoisted(() => vi.fn())
const readBotTeamFilePreview = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamFiles,
  readBotTeamFile,
  listBotTeamVersions,
  listBotTeamFileVersions: vi.fn(),
  readBotTeamVersionFile: vi.fn(),
  restoreBotTeamFileVersion: vi.fn()
}))
vi.mock('@/runtime/runtime-bot-team-client-project-files', () => ({
  listBotTeamProjectFiles,
  readBotTeamProjectFile,
  readBotTeamProjectFilePreview: vi.fn()
}))
vi.mock('./bot-team-file-preview-read', () => ({ readBotTeamFilePreview }))
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
const DECK = {
  workspaceId: 'ws-1',
  relativePath: 'docs/presentacion/nexuscare-features-deck.html',
  basename: 'nexuscare-features-deck.html',
  kind: 'text' as const
}
const BRIEF = {
  workspaceId: 'ws-1',
  relativePath: 'docs/project-brief/nexuscare-project-brief-borrador.md',
  basename: 'nexuscare-project-brief-borrador.md',
  kind: 'text' as const
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

beforeEach(() => {
  localStorage.clear()
  useBotTeamSeenFilesStore.setState({ seen: {} })
  listBotTeamFiles.mockResolvedValue({
    files: [{ relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' }],
    truncated: false
  })
  listBotTeamVersions.mockResolvedValue('unavailable')
  listBotTeamProjectFiles.mockResolvedValue({
    projects: [{ projectId: 'p1', name: 'NexusCare', files: [DECK, BRIEF] }],
    truncated: false
  })
  readBotTeamProjectFile.mockResolvedValue({
    worktree: 'ws-1',
    relativePath: BRIEF.relativePath,
    content: 'Goal: sell the offers',
    truncated: false,
    byteLength: 21
  })
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

function sectionFor(container: HTMLElement, name: string): HTMLElement {
  const section = [...container.querySelectorAll<HTMLElement>('section')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === name
  )
  if (!section) {
    throw new Error(`no section for ${name}`)
  }
  return section
}

describe('the Files of a team with linked projects', () => {
  it('lists the files its tasks changed in each linked project, under the project name', async () => {
    const container = await mount()

    const section = sectionFor(container, 'NexusCare')
    expect(section.textContent).toContain(DECK.relativePath)
    expect(section.textContent).toContain(BRIEF.relativePath)
    expect(container.textContent).toContain('flyer.html')
  })

  it('opens a project file where it is, without copying it into the team folder', async () => {
    const container = await mount()
    const brief = [...sectionFor(container, 'NexusCare').querySelectorAll('button')].find(
      (button) => button.textContent?.includes(BRIEF.relativePath)
    )

    await act(async () => brief?.click())

    expect(readBotTeamProjectFile).toHaveBeenCalledWith('ws-1', BRIEF.relativePath)
    expect(readBotTeamFile).not.toHaveBeenCalledWith('t1', BRIEF.relativePath)
    expect(container.querySelector('pre')?.textContent).toBe('Goal: sell the offers')
  })

  it('marks a project file a bot made until the person opens it', async () => {
    useBotTeamSeenFilesStore.setState({ seen: { t1: ['team:flyer.html'] } })
    const container = await mount()
    const dotted = sectionFor(container, 'NexusCare').querySelectorAll('[aria-label="New file"]')

    expect(dotted).toHaveLength(2)

    const brief = [...sectionFor(container, 'NexusCare').querySelectorAll('button')].find(
      (button) => button.textContent?.includes(BRIEF.relativePath)
    )
    await act(async () => brief?.click())

    expect(useBotTeamSeenFilesStore.getState().seen.t1).toContain(
      `project:ws-1:${BRIEF.relativePath}`
    )
  })

  it('shows no project section on a host from before linked project files', async () => {
    listBotTeamProjectFiles.mockResolvedValue('unavailable')

    const container = await mount()

    expect(container.querySelector('section')).toBeNull()
    expect(container.textContent).toContain('flyer.html')
  })
})
