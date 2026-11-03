/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamRoom = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom,
  postBotTeamRequest: vi.fn(),
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
vi.mock('./BotAgentIcon', () => ({
  BotAgentIcon: ({ agent }: { agent?: string }) => <i data-icon={agent} />
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { BotTeamRoom } = await import('./BotTeamRoom')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    { ...BOT, id: 'b1', name: 'Iris', job: 'Designs flyers', agent: 'claude' },
    { ...BOT, id: 'b2', name: 'Max', job: 'Writes copy', agent: 'codex' }
  ]
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the greeting line in the room', () => {
  it('shows one line from All with every bot icon, not a person bubble', async () => {
    listBotTeamRoom.mockResolvedValue({
      messages: [
        { id: 'm1', teamId: 't1', authorBotId: null, text: 'Hola' },
        { id: 'm2', teamId: 't1', authorBotId: 'all', text: 'Hola! 👋' }
      ],
      tasks: [],
      projects: [],
      workspaceId: null
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    await act(async () =>
      root.render(
        <BotTeamRoom team={TEAM} offline={false} openTaskId={null} onOpenTask={() => {}} />
      )
    )
    const rows = [...container.querySelectorAll('div.flex.flex-col.gap-3')]
    const all = rows.find((row) => row.textContent?.includes('Hola! 👋'))
    expect(all?.textContent).toContain('All')
    expect(
      [...(all?.querySelectorAll('[data-icon]') ?? [])].map((i) => i.getAttribute('data-icon'))
    ).toEqual(['claude', 'codex'])
    const person = rows.find((row) => row.textContent === 'Hola')
    expect(person?.querySelector('.self-end')).not.toBeNull()
    expect(all?.querySelector('.self-end')).toBeNull()
  })
})
