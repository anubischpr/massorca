/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamRoom = vi.hoisted(() => vi.fn())
const postBotTeamRequest = vi.hoisted(() => vi.fn())
const composer = vi.hoisted(() => ({
  onSend: (_text: string): Promise<boolean> => Promise.resolve(false)
}))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom,
  postBotTeamRequest,
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
vi.mock('./BotTeamRoomComposer', () => ({
  BotTeamRoomComposer: (props: { onSend: (text: string) => Promise<boolean> }) => {
    composer.onSend = props.onSend
    return null
  }
}))
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
  listBotTeamRoom.mockReset()
  postBotTeamRequest.mockReset()
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

async function mountRoom(): Promise<HTMLDivElement> {
  listBotTeamRoom.mockResolvedValue({ messages: [], tasks: [], projects: [], workspaceId: null })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamRoom team={TEAM} offline={false} openTaskId={null} onOpenTask={() => {}} />)
  )
  return container
}

const typingLine = (container: HTMLElement) =>
  container.querySelector('[role="status"]')?.textContent ?? null

describe('the typing line in the room', () => {
  it('shows who is typing until the reply comes back, then goes away', async () => {
    let reply: (value: object) => void = () => {}
    postBotTeamRequest.mockImplementation(() => new Promise((resolve) => (reply = resolve)))
    const container = await mountRoom()
    let sending!: Promise<boolean>
    await act(async () => {
      sending = composer.onSend('@Max can you write the copy?')
    })
    expect(typingLine(container)).toBe('Max is typing')
    await act(async () => {
      reply({ task: null, startError: null, answered: true })
      await sending
    })
    expect(typingLine(container)).toBeNull()
  })

  it('says All for a greeting and no name before a bot is picked', async () => {
    postBotTeamRequest.mockImplementation(() => new Promise(() => {}))
    const container = await mountRoom()
    await act(async () => {
      void composer.onSend('Hola!')
    })
    expect(typingLine(container)).toBe('All is typing')
  })

  it('shows a neutral line for a plain question, and clears it when the send fails', async () => {
    let fail: (error: Error) => void = () => {}
    postBotTeamRequest.mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)))
    const container = await mountRoom()
    let sending!: Promise<boolean>
    await act(async () => {
      sending = composer.onSend('Where did we leave NexusCare?')
    })
    expect(typingLine(container)).toBe('Typing')
    await act(async () => {
      fail(new Error('gone'))
      await sending
    })
    expect(typingLine(container)).toBeNull()
  })

  it('keeps the typing line while the host reports the reply in flight, polling faster, then clears it', async () => {
    vi.useFakeTimers()
    try {
      postBotTeamRequest.mockResolvedValue({
        task: null,
        startError: null,
        replying: { botId: 'b2' }
      })
      const container = await mountRoom()
      listBotTeamRoom.mockResolvedValue({
        messages: [],
        tasks: [],
        projects: [],
        workspaceId: null,
        replying: [{ botId: 'b2', since: 1 }]
      })
      await act(async () => {
        await composer.onSend('Qué es Jev AI?')
      })
      expect(typingLine(container)).toBe('Max is typing')
      const reads = listBotTeamRoom.mock.calls.length
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_100)
      })
      expect(listBotTeamRoom.mock.calls.length).toBeGreaterThanOrEqual(reads + 2)
      expect(typingLine(container)).toBe('Max is typing')
      listBotTeamRoom.mockResolvedValue({
        messages: [],
        tasks: [],
        projects: [],
        workspaceId: null,
        replying: []
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_600)
      })
      expect(typingLine(container)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not ask who should take a question the host is answering in the background', async () => {
    postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      replying: { botId: 'b1' }
    })
    const container = await mountRoom()
    await act(async () => {
      await composer.onSend('Qué es Jev AI?')
    })
    expect(container.textContent).not.toContain('Who should take this?')
  })

  it('shows no typing line after a host from before replying answers, as before', async () => {
    postBotTeamRequest.mockResolvedValue({ task: null, startError: null, answered: true })
    const container = await mountRoom()
    await act(async () => {
      await composer.onSend('Where did we leave NexusCare?')
    })
    expect(typingLine(container)).toBeNull()
  })

  it('sends one id per send and reuses it when the same send is retried', async () => {
    postBotTeamRequest.mockRejectedValueOnce(new Error('timeout'))
    postBotTeamRequest.mockResolvedValue({ task: null, startError: null, answered: true })
    await mountRoom()
    await act(async () => {
      await composer.onSend('Hola equipo')
    })
    await act(async () => {
      await composer.onSend('Hola equipo')
    })
    await act(async () => {
      await composer.onSend('Hola equipo')
    })
    const ids = postBotTeamRequest.mock.calls.map(([input]) => input.clientRequestId)
    expect(ids[0]).toEqual(expect.any(String))
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[0])
  })
})
