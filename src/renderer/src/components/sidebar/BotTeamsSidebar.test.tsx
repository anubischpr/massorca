/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function team(id: string, name: string, character: BotTeam['character']): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'default',
    bots: []
  }
}

const listBotTeams = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams, listBotTeamRoom }))
vi.mock('../bot-teams/use-bot-team-task-status', () => ({
  useBotTeamSessionStatuses: () => new Map()
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./SidebarSearchRow', () => ({
  SidebarSearchRow: () => <button type="button">Search</button>
}))

const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { BotTeamsSidebar } = await import('./BotTeamsSidebar')
const { useBotTeams } = await import('../bot-teams/use-bot-teams')
type BotTeamsState = ReturnType<typeof useBotTeams>

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamsSidebar />))
  return container
}

// A row's label is its first flexible span; the count beside it is not part of the name.
const labelOf = (button: HTMLButtonElement): string =>
  (button.querySelector('span.flex-1') ?? button).textContent?.trim() ?? ''

const rowLabels = (container: ParentNode): string[] =>
  [...container.querySelectorAll('button')].map(labelOf)

const rowByLabel = (container: ParentNode, label: string): HTMLButtonElement => {
  const row = [...container.querySelectorAll('button')].find((button) => labelOf(button) === label)
  if (!row) {
    throw new Error(`Row ${label} missing`)
  }
  return row
}

beforeEach(() => {
  listBotTeams.mockReset()
  listBotTeams.mockResolvedValue([team('t1', 'Marketing', 'square'), team('t2', 'Sales', 'circle')])
  listBotTeamRoom.mockReset()
  listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [] })
  seedStore(store, {
    activeView: 'bot-teams',
    railMode: 'bot-teams',
    botTeamsSelection: { teamId: null, taskId: null, creating: false }
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the Bot teams sidebar', () => {
  it('lists Search, All teams, then every team with its name', async () => {
    const container = await mount()
    expect(rowLabels(container)).toEqual(['Search', 'All teams', 'Marketing', 'Sales'])
  })

  it('has no Create button and no row for a surface that is not built', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
    const container = await mount()
    for (const absent of ['Create', 'Permissions']) {
      expect(rowLabels(container)).not.toContain(absent)
    }
  })

  it('shows the open team rows in the order of the design, under that team only', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't2', taskId: null, creating: false } })
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [{ id: 'p1', name: 'Summer campaign' }]
    })
    const container = await mount()
    expect(rowLabels(container)).toEqual([
      'Search',
      'All teams',
      'Marketing',
      'Sales',
      'Conference room',
      'Board',
      'Summer campaign',
      'New project',
      'Files',
      'Memory'
    ])
    expect(container.textContent).toContain('Nothing open')
    expect(container.textContent).toContain('No tasks')
    expect(container.textContent).toContain('Projects')
    expect(rowByLabel(container, 'Conference room').getAttribute('aria-current')).toBe('page')
  })

  it('opens the Board, a project and New project through the store', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [{ id: 'p1', name: 'Summer campaign' }]
    })
    const container = await mount()
    act(() => rowByLabel(container, 'Board').click())
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 't1',
      taskId: null,
      creating: false,
      section: { kind: 'board' }
    })
    expect(rowByLabel(container, 'Board').getAttribute('aria-current')).toBe('page')
    expect(rowByLabel(container, 'Conference room').getAttribute('aria-current')).toBeNull()
    act(() => rowByLabel(container, 'Summer campaign').click())
    expect(store.getState().botTeamsSelection.section).toEqual({
      kind: 'project',
      projectId: 'p1'
    })
    act(() => rowByLabel(container, 'New project').click())
    expect(store.getState().botTeamsSelection.section).toEqual({ kind: 'new-project' })
    act(() => rowByLabel(container, 'Files').click())
    expect(store.getState().botTeamsSelection.section).toEqual({ kind: 'files' })
    expect(rowByLabel(container, 'Files').getAttribute('aria-current')).toBe('page')
    act(() => rowByLabel(container, 'Memory').click())
    expect(store.getState().botTeamsSelection.section).toEqual({ kind: 'memory' })
    expect(rowByLabel(container, 'Memory').getAttribute('aria-current')).toBe('page')
    act(() => rowByLabel(container, 'Conference room').click())
    expect(store.getState().botTeamsSelection.section).toBeUndefined()
  })

  it('opens a team, All teams and the Conference room through the store', async () => {
    seedStore(store, {
      activeView: 'tasks',
      botTeamsSelection: { teamId: 't1', taskId: 'task-1', creating: false }
    })
    const container = await mount()
    act(() => rowByLabel(container, 'Sales').click())
    expect(store.getState().activeView).toBe('bot-teams')
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 't2',
      taskId: null,
      creating: false
    })
    act(() => rowByLabel(container, 'All teams').click())
    expect(store.getState().botTeamsSelection.teamId).toBeNull()
    act(() => rowByLabel(container, 'Marketing').click())
    act(() => rowByLabel(container, 'Conference room').click())
    expect(store.getState().botTeamsSelection).toEqual({
      teamId: 't1',
      taskId: null,
      creating: false
    })
  })

  it('does not mark the Conference room current while a task thread is open', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: 'task-1', creating: false } })
    const container = await mount()
    expect(rowByLabel(container, 'Conference room').getAttribute('aria-current')).toBeNull()
  })

  it('offers All teams and the existing New team action when there are no teams', async () => {
    listBotTeams.mockResolvedValue([])
    const container = await mount()
    expect(rowLabels(container)).toEqual(['Search', 'All teams', 'New team'])
    act(() => rowByLabel(container, 'New team').click())
    expect(store.getState().botTeamsSelection.creating).toBe(true)
    expect(store.getState().activeView).toBe('bot-teams')
  })

  it('drops a team deleted on the page at once, with no click in the sidebar', async () => {
    const container = await mount()
    expect(rowLabels(container)).toContain('Marketing')
    let applyChange!: BotTeamsState['applyChange']
    const Page = (): null => {
      ;({ applyChange } = useBotTeams())
      return null
    }
    const pageRoot = createRoot(document.createElement('div'))
    await act(async () => pageRoot.render(<Page />))
    listBotTeams.mockResolvedValue([team('t2', 'Sales', 'circle')])
    await act(async () => {
      await applyChange(async () => {})
    })
    expect(rowLabels(container)).not.toContain('Marketing')
    expect(rowLabels(container)).toContain('Sales')
    await act(async () => pageRoot.unmount())
  })
})
