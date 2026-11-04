/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { PrototypeCountSetting } from '../../../../shared/prototype-count-setting'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { useAppStore } from '@/store'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  listBotTeamRoom: vi.fn(),
  postBotTeamRequest: vi.fn(),
  fileBotTeamRequest: vi.fn()
}))
const sendText = vi.hoisted(() => ({ value: 'crea 3 prototipos de la landing' }))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom: client.listBotTeamRoom,
  postBotTeamRequest: client.postBotTeamRequest,
  fileBotTeamRequest: client.fileBotTeamRequest,
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
  BotTeamRoomComposer: ({
    onSend
  }: {
    onSend: (text: string, attachments?: unknown[]) => void
  }) => <button data-testid="send" onClick={() => onSend(sendText.value)} />
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => <i /> }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { BotTeamRoom } = await import('./BotTeamRoom')

const TEAM: BotTeam = {
  id: 'mk',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    {
      id: 'iris',
      name: 'Iris',
      job: 'Designs',
      agent: 'claude',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}

const mounted: { container: HTMLDivElement; root: Root }[] = []
beforeEach(() => {
  client.postBotTeamRequest.mockResolvedValue({ task: null, startError: null })
})
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
  sendText.value = 'crea 3 prototipos de la landing'
})

function setPrototypeCount(prototypeCount: PrototypeCountSetting): void {
  useAppStore.setState({ settings: { ...getDefaultSettings('/tmp'), prototypeCount } })
}

async function sendFromRoom() {
  client.listBotTeamRoom.mockResolvedValue({ messages: [], tasks: [], projects: [] })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamRoom team={TEAM} offline={false} openTaskId={null} onOpenTask={() => {}} />)
  )
  await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="send"]')?.click())
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent === name)
  return { container, button }
}

describe('a prototype request typed in the room', () => {
  it('asks how many prototypes before posting, then posts with the count chosen', async () => {
    setPrototypeCount({ mode: 'ask', count: 2 })
    const { container, button } = await sendFromRoom()

    expect(container.querySelector('[data-native-chat-prototype-count-card]')).not.toBeNull()
    expect(client.postBotTeamRequest).not.toHaveBeenCalled()

    await act(async () => button('3')?.click())

    expect(client.postBotTeamRequest).toHaveBeenCalledTimes(1)
    expect(client.postBotTeamRequest.mock.calls[0][0]).toMatchObject({
      teamId: 'mk',
      text: 'crea 3 prototipos de la landing',
      prototypeChoice: { count: 3 }
    })
    expect(container.querySelector('[data-native-chat-prototype-count-card]')).toBeNull()
  })

  it('posts the text as typed, with no choice, on "Not a prototype"', async () => {
    setPrototypeCount({ mode: 'ask', count: 2 })
    sendText.value = 'Make a mockup of the pricing page'
    const { button } = await sendFromRoom()
    await act(async () => button('Not a prototype')?.click())

    expect(client.postBotTeamRequest).toHaveBeenCalledTimes(1)
    expect(client.postBotTeamRequest.mock.calls[0][0]).not.toHaveProperty('prototypeChoice')
  })

  it('posts at once with the Settings count when an explicit command needs no question', async () => {
    setPrototypeCount({ mode: 'always', count: 4 })
    sendText.value = '/prototype una landing'
    const { container } = await sendFromRoom()

    expect(container.querySelector('[data-native-chat-prototype-count-card]')).toBeNull()
    expect(client.postBotTeamRequest.mock.calls[0][0]).toMatchObject({
      prototypeChoice: { count: 4 }
    })
  })

  it('hands the count to the project question, which files the request', async () => {
    setPrototypeCount({ mode: 'ask', count: 2 })
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'project', botId: 'iris' }
    })
    client.fileBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { button } = await sendFromRoom()
    await act(async () => button('3')?.click())
    await act(async () => button('Continue')?.click())

    expect(client.fileBotTeamRequest.mock.calls[0][0]).toMatchObject({
      text: 'crea 3 prototipos de la landing',
      botId: 'iris',
      prototypeChoice: { count: 3 }
    })
  })

  it('posts a message that is no prototype request at once, as before', async () => {
    setPrototypeCount({ mode: 'ask', count: 2 })
    sendText.value = 'Check inventory'
    const { container } = await sendFromRoom()

    expect(container.querySelector('[data-native-chat-prototype-count-card]')).toBeNull()
    expect(client.postBotTeamRequest).toHaveBeenCalledTimes(1)
    expect(client.postBotTeamRequest.mock.calls[0][0]).not.toHaveProperty('prototypeChoice')
  })
})
