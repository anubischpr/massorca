/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function team(id: string, name: string): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots: []
  }
}

const listBotTeams = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const statuses = vi.hoisted(() => ({ current: new Map<string, { status: string }>() }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeams,
  listBotTeamRoom,
  setBotTeamProjectWorkspace: vi.fn()
}))
vi.mock('@/runtime/runtime-bot-team-project-client', () => ({
  archiveBotTeamProject: vi.fn(),
  deleteBotTeamProject: vi.fn(),
  updateBotTeamProject: vi.fn()
}))
vi.mock('../bot-teams/use-bot-team-task-status', () => ({
  useBotTeamSessionStatuses: () => statuses.current
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

const rowOf = (container: ParentNode, text: string): HTMLButtonElement =>
  [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text)
  ) as HTMLButtonElement

const waitingIn = (row: HTMLElement): boolean =>
  row.querySelector('[data-bot-team-waiting]') !== null

beforeEach(() => {
  statuses.current = new Map()
  listBotTeams.mockResolvedValue([team('t1', 'Marketing'), team('t2', 'Sales')])
  listBotTeamRoom.mockImplementation(async (teamId: string) => ({
    messages: [],
    projects: [],
    tasks: [
      {
        id: `${teamId}-task`,
        title: 'Flyer',
        ownerBotId: null,
        sessionId: `${teamId}-session`,
        projectId: null
      }
    ]
  }))
  seedStore(store, {
    activeView: 'bot-teams',
    railMode: 'bot-teams',
    botTeamsSelection: { teamId: 't1', taskId: null, creating: false }
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the orange mark in the Bot teams sidebar', () => {
  it('marks the team row and its Conference room row while a task waits, and only that team', async () => {
    statuses.current = new Map([['t1-session', { status: 'attention' }]])
    const container = await mount()
    expect(waitingIn(rowOf(container, 'Marketing'))).toBe(true)
    expect(waitingIn(rowOf(container, 'Conference room'))).toBe(true)
    expect(waitingIn(rowOf(container, 'Sales'))).toBe(false)
    expect(waitingIn(rowOf(container, 'Board'))).toBe(false)
  })

  it('shows no mark when no task waits', async () => {
    statuses.current = new Map([['t1-session', { status: 'working' }]])
    const container = await mount()
    expect(container.querySelector('[data-bot-team-waiting]')).toBeNull()
  })
})
