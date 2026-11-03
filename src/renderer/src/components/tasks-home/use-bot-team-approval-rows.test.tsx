/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const team: BotTeam = {
  id: 'team-1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    {
      id: 'bot-1',
      name: 'Iris',
      job: '',
      agent: 'claude',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}
const task: BotTeamTask = {
  id: 'task-1',
  teamId: 'team-1',
  title: 'Publish the flyer',
  prompt: '',
  ownerBotId: 'bot-1',
  projectId: null,
  sessionId: 'session-1'
}
const otherTeam: BotTeam = {
  ...team,
  id: 'team-2',
  name: 'Support',
  bots: [{ id: 'bot-2', name: 'Max', job: '', agent: 'claude', modelMode: 'auto', model: null, effort: null, skills: [] }]
}
const otherTask: BotTeamTask = {
  id: 'task-2',
  teamId: 'team-2',
  title: 'Answer the ticket',
  prompt: '',
  ownerBotId: 'bot-2',
  sessionId: 'session-2'
}

const listBotTeams = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const statuses = vi.hoisted(() => ({ current: new Map<string, unknown>() }))
const host = vi.hoisted(() => ({ current: 'local' }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams, listBotTeamRoom }))
vi.mock('@/runtime/bot-team-host', () => ({ useBotTeamHost: () => host.current }))
vi.mock('../bot-teams/use-bot-team-task-status', () => ({
  useBotTeamSessionStatuses: () => statuses.current
}))

const { createTestStore } = await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))

const { useBotTeamApprovalRows } = await import('./use-bot-team-approval-rows')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function Probe(): React.JSX.Element {
  return (
    <p>
      {useBotTeamApprovalRows()
        .map((row) => row.title)
        .join('|')}
    </p>
  )
}

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<Probe />))
  return container
}

async function rerenderAfterHostChange(): Promise<void> {
  await act(async () => {
    mounted.at(-1)?.root.render(<Probe />)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  listBotTeams.mockReset()
  listBotTeamRoom.mockReset()
  listBotTeams.mockResolvedValue([team])
  listBotTeamRoom.mockResolvedValue({ tasks: [task], messages: [] })
  statuses.current = new Map([['session-1', { status: 'attention', turnOutcome: null }]])
  host.current = 'local'
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('useBotTeamApprovalRows', () => {
  it('reads the host through the runtime client and lists the task waiting for the person', async () => {
    expect((await mount()).textContent).toBe('Publish the flyer')
    expect(listBotTeamRoom).toHaveBeenCalledWith('team-1')
  })

  it('lists nothing while the bot is working', async () => {
    statuses.current = new Map([['session-1', { status: 'running', turnOutcome: null }]])
    expect((await mount()).textContent).toBe('')
  })

  it('adds no rows when the host cannot answer', async () => {
    listBotTeams.mockRejectedValue(new Error('unreachable'))
    expect((await mount()).textContent).toBe('')
  })

  it('reads the teams of the new host when the person picks another bot team host', async () => {
    const container = await mount()
    expect(container.textContent).toBe('Publish the flyer')

    host.current = 'env-2'
    listBotTeams.mockResolvedValue([otherTeam])
    listBotTeamRoom.mockResolvedValue({ tasks: [otherTask], messages: [] })
    statuses.current = new Map([['session-2', { status: 'attention', turnOutcome: null }]])
    await rerenderAfterHostChange()

    expect(listBotTeams).toHaveBeenCalledTimes(2)
    expect(container.textContent).toBe('Answer the ticket')
  })

  it('keeps the rows of the other teams when one team room cannot be read', async () => {
    listBotTeams.mockResolvedValue([team, otherTeam])
    listBotTeamRoom.mockImplementation(async (teamId: string) => {
      if (teamId === 'team-2') {
        throw new Error('room unavailable')
      }
      return { tasks: [task], messages: [] }
    })
    expect((await mount()).textContent).toBe('Publish the flyer')
  })
})
