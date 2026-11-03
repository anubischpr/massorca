/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({ listBotTeamRoom: vi.fn() }))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom: client.listBotTeamRoom,
  postBotTeamRequest: vi.fn(),
  fileBotTeamRequest: vi.fn(),
  setBotTeamTaskProject: vi.fn(),
  startBotTeamTask: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('@/runtime/bot-team-host', () => ({
  BOT_TEAM_LOCAL_HOST: 'local',
  botTeamHostTarget: () => ({ kind: 'local' }),
  useBotTeamHost: () => 'local'
}))
vi.mock('@/components/native-chat/NativeChatView', () => ({ default: () => null }))
vi.mock('@/components/native-chat/use-pending-session-question', () => ({
  usePendingSessionQuestion: () => null
}))
vi.mock('@/components/native-chat/NativeChatStructuredQuestionCard', () => ({
  NativeChatStructuredQuestionCard: () => null
}))
vi.mock('../../app-shell/right-sidebar-page-slot', () => ({
  useRightSidebarPageTarget: () => null
}))
const statuses = vi.hoisted(() => ({ map: new Map<string, unknown>() }))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => statuses.map }))
vi.mock('./BotTeamRoomComposer', () => ({ BotTeamRoomComposer: () => null }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => <i /> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { BotTeamRoom } = await import('./BotTeamRoom')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 'mk',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [{ ...BOT, id: 'iris', name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
}
const WAREHOUSE: BotTeam = {
  id: 'wh',
  name: 'Warehouse',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [{ ...BOT, id: 'bea', name: 'Bea', job: 'Counts stock', agent: 'claude' }]
}
const TASK = {
  id: 'wt',
  teamId: 'wh',
  title: 'Count the flyer boxes',
  prompt: 'Count',
  ownerBotId: 'bea',
  sessionId: 'sess-1',
  projectId: null,
  createdAt: 200
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  statuses.map = new Map()
  vi.clearAllMocks()
})

async function mountRoom(
  room: Record<string, unknown>,
  onOpenTeam = vi.fn()
): Promise<HTMLDivElement> {
  client.listBotTeamRoom.mockResolvedValue({ projects: [], ...room })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamRoom
        team={TEAM}
        offline={false}
        openTaskId={null}
        onOpenTask={() => {}}
        otherTeams={[WAREHOUSE]}
        onOpenTeam={onOpenTeam}
      />
    )
  )
  return container
}

const ASKED = {
  id: 'm1',
  teamId: 'mk',
  authorBotId: null,
  text: '@Warehouse count boxes',
  createdAt: 100
}

describe('a request sent to another team', () => {
  it('shows a tracker card under the request with the team, the title and Open in', async () => {
    statuses.map = new Map([['sess-1', { status: 'working', turnOutcome: null }]])
    const onOpenTeam = vi.fn()
    const container = await mountRoom(
      {
        messages: [
          ASKED,
          { id: 'm2', teamId: 'mk', authorBotId: null, text: 'Thanks', createdAt: 300 }
        ],
        tasks: [],
        sentRequests: [{ task: TASK, messageId: 'm1' }]
      },
      onOpenTeam
    )

    const text = container.textContent ?? ''
    const card = container.querySelector('[data-bot-team-request-tracker]')
    expect(card?.textContent).toContain('Warehouse')
    expect(card?.textContent).toContain('Count the flyer boxes')
    expect(card?.textContent).toContain('Working')
    expect(text.indexOf('@Warehouse count boxes')).toBeLessThan(
      text.indexOf('Count the flyer boxes')
    )
    expect(text.indexOf('Count the flyer boxes')).toBeLessThan(text.indexOf('Thanks'))

    const open = card?.querySelector<HTMLButtonElement>('button')
    expect(open?.textContent).toBe('Open in Warehouse')
    await act(async () => open?.click())
    expect(onOpenTeam).toHaveBeenCalledWith('wh', 'wt')
  })

  it('never says In progress for a status the host has not answered', async () => {
    const container = await mountRoom({
      messages: [ASKED],
      tasks: [],
      sentRequests: [{ task: TASK, messageId: 'm1' }]
    })

    const card = container.querySelector('[data-bot-team-request-tracker]')
    expect(card?.textContent).not.toContain('Working')
    expect(card?.querySelector('[data-bot-team-status-placeholder]')).not.toBeNull()
  })

  it('shows the returned result with the other team character and the file tagged From Warehouse', async () => {
    const container = await mountRoom({
      messages: [
        ASKED,
        {
          id: 'm3',
          teamId: 'mk',
          authorBotId: 'bea',
          fromTeamId: 'wh',
          text: 'Counted 42 boxes.',
          createdAt: 400,
          attachments: [{ path: 'attachments/from-warehouse-boxes.xlsx', name: 'boxes.xlsx' }]
        }
      ],
      tasks: [],
      sentRequests: [{ task: TASK, messageId: 'm1' }]
    })

    const text = container.textContent ?? ''
    expect(text).toContain('Bea')
    expect(text).toContain('Counted 42 boxes.')
    expect(text).toContain('boxes.xlsx')
    expect(text).toContain('From Warehouse')
  })
})
