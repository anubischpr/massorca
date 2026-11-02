/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const room = vi.hoisted(() => ({ listBotTeamRoom: vi.fn() }))
const statuses = vi.hoisted(() => ({ current: new Map<string, { status: string }>() }))
const pending = vi.hoisted(() => ({
  bySession: new Map<string, { answer: ReturnType<typeof vi.fn> }>(),
  asked: [] as (string | null)[]
}))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom: room.listBotTeamRoom,
  postBotTeamRequest: vi.fn(),
  setBotTeamTaskProject: vi.fn(),
  startBotTeamTask: vi.fn()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('@/runtime/bot-team-host', () => ({
  botTeamHostTarget: () => ({ kind: 'local' }),
  useBotTeamHost: () => 'local'
}))
vi.mock('@/components/native-chat/NativeChatView', () => ({ default: () => null }))
vi.mock('@/components/native-chat/use-pending-session-question', () => ({
  usePendingSessionQuestion: (sessionId: string | null) => {
    pending.asked.push(sessionId)
    const entry = sessionId === null ? undefined : pending.bySession.get(sessionId)
    return entry
      ? {
          itemId: 'q1',
          revision: 1,
          prompt: { questions: [{ id: 'q', question: 'Which logo?' }], delegation: undefined },
          isSubmitting: false,
          answer: entry.answer,
          cancel: vi.fn()
        }
      : null
  }
}))
vi.mock('@/components/native-chat/NativeChatStructuredQuestionCard', () => ({
  NativeChatStructuredQuestionCard: ({
    onAnswer
  }: {
    onAnswer: (response: { kind: string }) => void
  }) => (
    <button data-testid="question-card" onClick={() => onAnswer({ kind: 'answers' })}>
      Which logo?
    </button>
  )
}))
vi.mock('../../app-shell/right-sidebar-page-slot', () => ({
  useRightSidebarPageTarget: () => null
}))
vi.mock('./use-bot-team-task-status', () => ({
  useBotTeamSessionStatuses: () => statuses.current
}))
vi.mock('./BotTeamRoomComposer', () => ({ BotTeamRoomComposer: () => null }))
vi.mock('./BotAgentIcon', () => ({
  BotAgentIcon: ({ agent }: { agent?: string }) => <i data-agent={agent} />
}))
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
  bots: [{ ...BOT, id: 'iris', name: 'Iris', job: 'Designs', agent: 'claude' }]
}
const task = (id: string, sessionId: string | null) => ({
  id,
  title: `Task ${id}`,
  ownerBotId: 'iris',
  sessionId,
  projectId: null
})

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mountRoom(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamRoom team={TEAM} offline={false} openTaskId={null} onOpenTask={() => {}} />)
  )
  return container
}

beforeEach(() => {
  statuses.current = new Map()
  pending.bySession.clear()
  pending.asked.length = 0
  room.listBotTeamRoom.mockResolvedValue({
    messages: [],
    tasks: [task('t1', 's1'), task('t2', 's2')],
    projects: [],
    workspaceId: null
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('a task session waiting for the person, in the room', () => {
  it('shows the question card under the task bot and answers the session from it', async () => {
    statuses.current = new Map([['s1', { status: 'attention' }]])
    const answer = vi.fn()
    pending.bySession.set('s1', { answer })
    const container = await mountRoom()
    const card = container.querySelector('[data-testid="question-card"]') as HTMLElement
    expect(card).not.toBeNull()
    const entry = card.closest('[data-bot-team-question]')
    expect(entry?.textContent).toContain('Iris')
    expect(entry?.querySelector('[data-agent="claude"]')).not.toBeNull()
    await act(async () => card.click())
    expect(answer).toHaveBeenCalledWith({ kind: 'answers' })
  })

  it('shows no card for a task whose session is not waiting, and never reads its session', async () => {
    statuses.current = new Map([
      ['s1', { status: 'attention' }],
      ['s2', { status: 'working' }]
    ])
    pending.bySession.set('s1', { answer: vi.fn() })
    pending.bySession.set('s2', { answer: vi.fn() })
    const container = await mountRoom()
    expect(container.querySelectorAll('[data-testid="question-card"]')).toHaveLength(1)
    expect(pending.asked).not.toContain('s2')
  })

  it('draws nothing when the waiting session has no pending question (an approval)', async () => {
    statuses.current = new Map([['s1', { status: 'attention' }]])
    const container = await mountRoom()
    expect(container.querySelector('[data-testid="question-card"]')).toBeNull()
    expect(container.querySelector('[data-bot-team-question]')).toBeNull()
  })

  it('drops the card once the session stops waiting', async () => {
    statuses.current = new Map([['s1', { status: 'attention' }]])
    pending.bySession.set('s1', { answer: vi.fn() })
    const container = await mountRoom()
    expect(container.querySelector('[data-testid="question-card"]')).not.toBeNull()
    pending.bySession.clear()
    statuses.current = new Map([['s1', { status: 'idle' }]])
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5_100))
    })
    expect(container.querySelector('[data-testid="question-card"]')).toBeNull()
  }, 10_000)
})

describe('the orange mark on a task card', () => {
  it('paints the card in the question orange while its task waits, and not otherwise', async () => {
    statuses.current = new Map([
      ['s1', { status: 'attention' }],
      ['s2', { status: 'working' }]
    ])
    const container = await mountRoom()
    const cards = [...container.querySelectorAll('[data-bot-team-task-card]')]
    expect(cards).toHaveLength(2)
    expect(cards[0]!.className).toContain('border-agent-question')
    expect(cards[0]!.querySelector('.text-agent-question')).not.toBeNull()
    expect(cards[1]!.className).not.toContain('border-agent-question')
    expect(cards[1]!.querySelector('.text-agent-question')).toBeNull()
  })
})
