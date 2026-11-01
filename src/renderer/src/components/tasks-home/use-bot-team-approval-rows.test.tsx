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
  bots: [{ id: 'bot-1', name: 'Iris', job: '', agent: 'claude' }]
}
const task: BotTeamTask = {
  id: 'task-1',
  teamId: 'team-1',
  title: 'Publish the flyer',
  prompt: '',
  ownerBotId: 'bot-1',
  sessionId: 'session-1'
}

const listBotTeams = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const statuses = vi.hoisted(() => ({ current: new Map<string, unknown>() }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeams, listBotTeamRoom }))
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

beforeEach(() => {
  listBotTeams.mockReset()
  listBotTeamRoom.mockReset()
  listBotTeams.mockResolvedValue([team])
  listBotTeamRoom.mockResolvedValue({ tasks: [task], messages: [] })
  statuses.current = new Map([['session-1', { status: 'attention', turnOutcome: null }]])
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
})
