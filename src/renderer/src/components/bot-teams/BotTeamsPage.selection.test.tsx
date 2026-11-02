/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const teams: BotTeam[] = [
  {
    id: 't1',
    name: 'Marketing',
    purpose: 'Campaigns',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: []
  },
  {
    id: 't2',
    name: 'Sales',
    purpose: 'Leads',
    character: 'circle',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: []
  }
]

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams: () => Promise.resolve(teams),
  listBotTeamRoom: () => Promise.resolve({ tasks: [], messages: [] }),
  updateBotOnTeam: vi.fn(),
  updateBotTeam: vi.fn(),
  addBotToTeam: vi.fn(),
  createBotTeam: vi.fn(),
  deleteBotTeam: vi.fn(),
  removeBotFromTeam: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => new Map() }))
vi.mock('@/components/sidebar/StatusIndicator', () => ({ default: () => null }))
vi.mock('./BotTeamRoom', () => ({
  BotTeamRoom: ({
    openTaskId,
    header
  }: {
    openTaskId: string | null
    header?: React.ReactNode
  }) => (
    <div>
      {header}
      <div data-testid="room">{openTaskId ?? 'room'}</div>
    </div>
  )
}))

const { default: BotTeamsPage } = await import('./BotTeamsPage')

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(element: React.JSX.Element): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(element))
  return container
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the team cards', () => {
  it('shows each team’s state and description, and edits without opening it', async () => {
    const container = await mount(<BotTeamsPage />)
    expect(container.textContent).toContain('Nothing running')
    expect(container.textContent).toContain('Leads')

    const edit = container.querySelector('[aria-label="Edit team"]')
    await act(async () => edit?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.textContent).toContain('Edit team')
    expect(container.querySelector('[data-testid="room"]')).toBeNull()
  })
})

describe('the Bot teams page with a controlled selection', () => {
  it('shows the team the selection names', async () => {
    const container = await mount(
      <BotTeamsPage
        selection={{ teamId: 't2', taskId: null, creating: false }}
        onSelectionChange={() => {}}
      />
    )
    expect(container.textContent).toContain('Sales')
    expect(container.querySelector('[data-testid="room"]')?.textContent).toBe('room')
  })

  it('shows the thread of the task the selection names', async () => {
    const container = await mount(
      <BotTeamsPage
        selection={{ teamId: 't1', taskId: 'task-1', creating: false }}
        onSelectionChange={() => {}}
      />
    )
    expect(container.querySelector('[data-testid="room"]')?.textContent).toBe('task-1')
  })

  it('shows the new team form when the selection says so', async () => {
    const container = await mount(
      <BotTeamsPage
        selection={{ teamId: null, taskId: null, creating: true }}
        onSelectionChange={() => {}}
      />
    )
    expect(
      container.querySelector('form, [data-new-bot-team]') ?? container.textContent
    ).toBeTruthy()
    expect(container.textContent).not.toContain('All teams')
  })

  it('shows the section the selection names instead of the room, and goes back to the room', async () => {
    const onSelectionChange = vi.fn()
    const container = await mount(
      <BotTeamsPage
        selection={{ teamId: 't1', taskId: null, creating: false, section: { kind: 'board' } }}
        onSelectionChange={onSelectionChange}
      />
    )
    expect(container.querySelector('[data-testid="room"]')).toBeNull()
    expect(container.textContent).toContain('all tasks')
    const back = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Conference room')
    )
    act(() => back?.click())
    expect(onSelectionChange).toHaveBeenCalledWith({ teamId: 't1', taskId: null, creating: false })
  })

  it('opens the new project form from its section', async () => {
    const container = await mount(
      <BotTeamsPage
        selection={{
          teamId: 't1',
          taskId: null,
          creating: false,
          section: { kind: 'new-project' }
        }}
        onSelectionChange={() => {}}
      />
    )
    expect(container.textContent).toContain('A project holds the why. Its tasks hold the how.')
  })

  it('reports opening a team from the grid instead of keeping it to itself', async () => {
    const onSelectionChange = vi.fn()
    const container = await mount(
      <BotTeamsPage
        selection={{ teamId: null, taskId: null, creating: false }}
        onSelectionChange={onSelectionChange}
      />
    )
    const card = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Marketing')
    )
    act(() => card?.click())
    expect(onSelectionChange).toHaveBeenCalledWith({ teamId: 't1', taskId: null, creating: false })
  })

  it('still works on its own when nothing controls it', async () => {
    const container = await mount(<BotTeamsPage />)
    const card = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Marketing')
    )
    await act(async () => card?.click())
    expect(container.textContent).toContain('Marketing')
  })
})
