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
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => new Map() }))
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

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mountRoom(messages: unknown[], tasks: unknown[]): Promise<HTMLDivElement> {
  client.listBotTeamRoom.mockResolvedValue({ messages, tasks, projects: [] })
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
        otherTeams={[]}
      />
    )
  )
  return container
}

describe('the room timeline', () => {
  it('shows a card made from an earlier request after that request, before a later message', async () => {
    const container = await mountRoom(
      [
        { id: 'a', teamId: 'mk', authorBotId: null, text: 'Make the report', createdAt: 100 },
        { id: 'b', teamId: 'mk', authorBotId: null, text: 'Thanks, that is all', createdAt: 300 }
      ],
      [
        {
          id: 't',
          teamId: 'mk',
          title: 'Quarterly deck',
          prompt: 'Build the slides',
          ownerBotId: 'iris',
          sessionId: null,
          projectId: null,
          createdAt: 200
        }
      ]
    )

    const text = container.textContent ?? ''
    expect(text.indexOf('Make the report')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('Make the report')).toBeLessThan(text.indexOf('Quarterly deck'))
    expect(text.indexOf('Quarterly deck')).toBeLessThan(text.indexOf('Thanks, that is all'))
  })
})
