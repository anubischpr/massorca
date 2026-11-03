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
const archiveBotTeamProject = vi.hoisted(() => vi.fn())
const deleteBotTeamProject = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams,
  listBotTeamRoom,
  setBotTeamProjectWorkspace: vi.fn()
}))
vi.mock('@/runtime/runtime-bot-team-project-client', () => ({
  archiveBotTeamProject,
  deleteBotTeamProject,
  updateBotTeamProject: vi.fn()
}))
vi.mock('../bot-teams/use-bot-team-task-status', () => ({
  useBotTeamSessionStatuses: () => new Map()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./SidebarSearchRow', () => ({
  SidebarSearchRow: () => <button type="button">Search</button>
}))

const { TooltipProvider } = await import('@/components/ui/tooltip')
const { createTestStore, seedStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { BotTeamsSidebar } = await import('./BotTeamsSidebar')
const { useBotTeams } = await import('../bot-teams/use-bot-teams')
const { resetBotTeamRoomCountsForTests } = await import('./bot-team-sidebar-counts')
type BotTeamsState = ReturnType<typeof useBotTeams>

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <TooltipProvider>
        <BotTeamsSidebar />
      </TooltipProvider>
    )
  )
  return container
}

// A row's label is its first flexible span; the count beside it is not part of the name.
const labelOf = (button: HTMLButtonElement): string =>
  button.getAttribute('aria-label') ??
  (button.querySelector('span.flex-1') ?? button).textContent?.trim() ??
  ''

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
  resetBotTeamRoomCountsForTests()
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
      'Filters',
      'New project',
      'Summer campaign',
      'Files',
      'Memory',
      'Routines'
    ])
    expect(container.textContent).toContain('Nothing open')
    expect(container.textContent).toContain('No tasks')
    expect(container.textContent).toContain('Projects')
    expect(rowByLabel(container, 'Conference room').getAttribute('aria-current')).toBe('page')
  })

  it('counts one task in the singular', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't2', taskId: null, creating: false } })
    listBotTeamRoom.mockResolvedValue({
      tasks: [
        {
          id: 'k1',
          teamId: 't2',
          title: 'Flyer',
          prompt: 'Flyer',
          ownerBotId: 'b1',
          sessionId: null,
          projectId: null
        }
      ],
      messages: [],
      projects: []
    })
    const container = await mount()
    expect(container.textContent).toContain('1 task')
    expect(container.textContent).not.toContain('1 tasks')
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
    act(() => rowByLabel(container, 'Routines').click())
    expect(store.getState().botTeamsSelection.section).toEqual({ kind: 'routines' })
    expect(rowByLabel(container, 'Routines').getAttribute('aria-current')).toBe('page')
    act(() => rowByLabel(container, 'Conference room').click())
    expect(store.getState().botTeamsSelection.section).toBeUndefined()
  })

  it('keeps Routines current while a routine or the new routine form is open', async () => {
    seedStore(store, {
      botTeamsSelection: {
        teamId: 't1',
        taskId: null,
        creating: false,
        section: { kind: 'routine-new' }
      }
    })
    const container = await mount()
    expect(rowByLabel(container, 'Routines').getAttribute('aria-current')).toBe('page')
    act(() => {
      store.getState().setBotTeamsSelection({
        teamId: 't1',
        taskId: null,
        creating: false,
        section: { kind: 'routine', routineId: 'r1' }
      })
    })
    expect(rowByLabel(container, 'Routines').getAttribute('aria-current')).toBe('page')
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

  describe('projects', () => {
    const project = (fields: Record<string, unknown>) => ({
      id: 'p1',
      teamId: 't1',
      name: 'NexusCare',
      goal: '',
      codeSource: null,
      linkedTeamIds: [],
      archivedAt: null,
      ...fields
    })

    async function openTeamWith(projects: unknown[], teamId = 't1'): Promise<HTMLDivElement> {
      seedStore(store, { botTeamsSelection: { teamId, taskId: null, creating: false } })
      listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects, projectTasks: [] })
      return mount()
    }

    const rightClick = (row: HTMLElement): void =>
      act(() => {
        row.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 20,
            clientY: 20
          })
        )
      })

    const menuItems = (): string[] =>
      [...document.body.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.textContent?.trim() ?? ''
      )

    it('has no New project row: New project is the + of the Projects heading', async () => {
      const container = await openTeamWith([project({})])
      const labels = rowLabels(container)
      expect(labels.filter((label) => label === 'New project')).toHaveLength(1)
      expect(labels.indexOf('New project')).toBeLessThan(labels.indexOf('NexusCare'))
      act(() => rowByLabel(container, 'New project').click())
      expect(store.getState().botTeamsSelection.section).toEqual({ kind: 'new-project' })
    })

    it('opens Edit, Link team, Archive and Delete from a right-click on the owner team’s project', async () => {
      const container = await openTeamWith([project({})])
      rightClick(rowByLabel(container, 'NexusCare'))
      expect(menuItems()).toEqual(['Edit', 'Link team', 'Archive', 'Delete'])
    })

    it('gives a linked project only Edit and Link team, and marks it with the owner team', async () => {
      const container = await openTeamWith(
        [project({ id: 'p9', teamId: 't2', name: 'Website', linkedTeamIds: ['t1'] })],
        't1'
      )
      expect(container.querySelector('[aria-label="Owner: Sales"]')).not.toBeNull()
      rightClick(rowByLabel(container, 'Website'))
      expect(menuItems()).toEqual(['Edit', 'Link team'])
    })

    it('archives from the menu as the owner team', async () => {
      archiveBotTeamProject.mockResolvedValue({})
      const container = await openTeamWith([project({})])
      rightClick(rowByLabel(container, 'NexusCare'))
      const archive = [...document.body.querySelectorAll('[role="menuitem"]')].find(
        (item) => item.textContent === 'Archive'
      )
      await act(async () => (archive as HTMLElement).click())
      expect(archiveBotTeamProject).toHaveBeenCalledWith({
        projectId: 'p1',
        teamId: 't1',
        archived: true
      })
    })

    it('hides archived projects until Show archived is on, then greys them with Restore', async () => {
      const container = await openTeamWith([project({ archivedAt: 5 })])
      expect(rowLabels(container)).not.toContain('NexusCare')
      act(() => {
        rowByLabel(container, 'Filters').dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
        )
      })
      const showArchived = document.body.querySelector('[role="menuitemcheckbox"]')
      expect(showArchived?.textContent).toBe('Show archived')
      await act(async () => (showArchived as HTMLElement).click())
      expect(rowLabels(container)).toContain('NexusCare')
      expect(container.textContent).toContain('Archived')
      rightClick(rowByLabel(container, 'NexusCare'))
      expect(menuItems()).toEqual(['Edit', 'Link team', 'Restore', 'Delete'])
    })

    it('asks before deleting and then deletes as the owner team', async () => {
      deleteBotTeamProject.mockResolvedValue('deleted')
      const container = await openTeamWith([project({})])
      rightClick(rowByLabel(container, 'NexusCare'))
      const remove = [...document.body.querySelectorAll('[role="menuitem"]')].find(
        (item) => item.textContent === 'Delete'
      )
      await act(async () => (remove as HTMLElement).click())
      expect(document.body.textContent).toContain('Delete NexusCare?')
      expect(deleteBotTeamProject).not.toHaveBeenCalled()
      const confirm = [...document.body.querySelectorAll('[role="alertdialog"] button')].find(
        (button) => button.textContent === 'Delete'
      )
      await act(async () => (confirm as HTMLElement).click())
      expect(deleteBotTeamProject).toHaveBeenCalledWith({ projectId: 'p1', teamId: 't1' })
    })

    it('opens no menu on a host from before shared projects', async () => {
      const container = await openTeamWith([project({ linkedTeamIds: undefined })])
      rightClick(rowByLabel(container, 'NexusCare'))
      expect(menuItems()).toEqual([])
    })
  })

  describe('counts', () => {
    const flyer = (id: string, teamId: string) => ({
      id,
      teamId,
      title: 'Flyer',
      prompt: 'Flyer',
      ownerBotId: 'b1',
      sessionId: null,
      projectId: null
    })
    // Marketing has one task and Sales two.
    const roomOf = (teamId: string) => ({
      messages: [],
      projects: [],
      tasks: Array.from({ length: teamId === 't2' ? 2 : 1 }, (_, index) =>
        flyer(`${teamId}-${index}`, teamId)
      )
    })
    const answerNever = (): void => {
      listBotTeamRoom.mockImplementation(() => new Promise(() => {}))
    }

    it('shows neither Nothing open nor No tasks before the team answers', async () => {
      seedStore(store, { botTeamsSelection: { teamId: 't2', taskId: null, creating: false } })
      let answer!: (room: unknown) => void
      listBotTeamRoom.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        })
      )
      const container = await mount()
      expect(container.textContent).toContain('Conference room')
      expect(container.textContent).not.toContain('Nothing open')
      expect(container.textContent).not.toContain('No tasks')
      await act(async () => answer({ messages: [], projects: [], tasks: [] }))
      expect(container.textContent).toContain('Nothing open')
      expect(container.textContent).toContain('No tasks')
    })

    it('shows another team’s counts at once, from the answers loaded before the switch', async () => {
      seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
      listBotTeamRoom.mockImplementation(async (teamId: string) => roomOf(teamId))
      const container = await mount()
      expect(container.textContent).toContain('1 task')
      // No request answers from here on, so Sales' counts can only come from what is kept.
      answerNever()
      act(() => rowByLabel(container, 'Sales').click())
      expect(container.textContent).toContain('2 tasks')
      expect(container.textContent).not.toContain('No tasks')
      act(() => rowByLabel(container, 'Marketing').click())
      expect(container.textContent).toContain('1 task')
    })

    it('starts every team’s room at once and asks for each team only once', async () => {
      seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
      answerNever()
      await mount()
      expect(listBotTeamRoom.mock.calls.map(([teamId]) => teamId).sort()).toEqual(['t1', 't2'])
    })

    it('answers a refresh made while a request is in flight with a newer request', async () => {
      seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
      listBotTeamRoom.mockImplementation(async (teamId: string) => roomOf(teamId))
      const container = await mount()
      expect(container.textContent).toContain('1 task')
      let releaseStale!: (room: unknown) => void
      listBotTeamRoom.mockReturnValueOnce(
        new Promise((resolve) => {
          releaseStale = resolve
        })
      )
      // Board starts a request that stays in flight; Files asks again while it runs.
      act(() => rowByLabel(container, 'Board').click())
      listBotTeamRoom.mockResolvedValueOnce({
        messages: [],
        projects: [],
        tasks: [flyer('t1-a', 't1'), flyer('t1-b', 't1')]
      })
      act(() => rowByLabel(container, 'Files').click())
      await act(async () => {
        releaseStale({ messages: [], projects: [], tasks: [flyer('t1-0', 't1')] })
        await new Promise((done) => setTimeout(done, 0))
      })
      expect(listBotTeamRoom.mock.calls.filter(([teamId]) => teamId === 't1')).toHaveLength(3)
      expect(container.textContent).toContain('2 tasks')
    })

    it('counts one open task as 1 open', async () => {
      seedStore(store, { botTeamsSelection: { teamId: 't2', taskId: null, creating: false } })
      listBotTeamRoom.mockResolvedValue({
        messages: [],
        projects: [],
        tasks: [flyer('t2-0', 't2')]
      })
      const container = await mount()
      expect(container.textContent).toContain('1 open')
    })
  })
})
