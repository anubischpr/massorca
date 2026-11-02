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
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams }))
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

const rowLabels = (container: ParentNode): string[] =>
  [...container.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? '')

const rowByLabel = (container: ParentNode, label: string): HTMLButtonElement => {
  const row = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label
  )
  if (!row) {
    throw new Error(`Row ${label} missing`)
  }
  return row
}

beforeEach(() => {
  listBotTeams.mockReset()
  listBotTeams.mockResolvedValue([team('t1', 'Marketing', 'square'), team('t2', 'Sales', 'circle')])
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

  it('has no Create button or workspace list', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
    const container = await mount()
    expect(rowLabels(container)).not.toContain('Create')
  })

  it('shows every board row under the open team only, in order', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't2', taskId: null, creating: false } })
    const container = await mount()
    expect(rowLabels(container)).toEqual([
      'Search',
      'All teams',
      'Marketing',
      'Sales',
      'Conference room',
      'Board',
      'New project',
      'Files',
      'Memory',
      'Permissions'
    ])
    expect(container.textContent).toContain('Projects')
    expect(rowByLabel(container, 'Conference room').getAttribute('aria-current')).toBe('page')
  })

  it('keeps rows without a screen disabled, so clicking them changes nothing', async () => {
    seedStore(store, { botTeamsSelection: { teamId: 't1', taskId: null, creating: false } })
    const container = await mount()
    expect(rowByLabel(container, 'Conference room').disabled).toBe(false)
    for (const label of ['Board', 'New project', 'Files', 'Memory', 'Permissions']) {
      const row = rowByLabel(container, label)
      expect(row.disabled).toBe(true)
      act(() => row.click())
      expect(store.getState().botTeamsSelection).toEqual({
        teamId: 't1',
        taskId: null,
        creating: false
      })
    }
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
