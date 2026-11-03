/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const client = vi.hoisted(() => ({
  listBotTeamRoom: vi.fn(),
  postBotTeamRequest: vi.fn(),
  fileBotTeamRequest: vi.fn()
}))

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
  BotTeamRoomComposer: ({ onSend }: { onSend: (text: string) => void }) => (
    <button data-testid="send" onClick={() => onSend('Check inventory')} />
  )
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => <i /> }))
const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

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
const WAREHOUSE: BotTeam = { ...TEAM, id: 'wh', name: 'Warehouse', purpose: 'Inventory', bots: [] }

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.clearAllMocks()
})

async function mountRoom(
  props: Partial<Parameters<typeof BotTeamRoom>[0]> = {},
  room: { tasks?: unknown[]; projects?: unknown[] } = {}
) {
  client.listBotTeamRoom.mockResolvedValue({
    messages: [],
    tasks: room.tasks ?? [],
    projects: room.projects ?? []
  })
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
        {...props}
      />
    )
  )
  await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="send"]')?.click())
  const button = (name: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent === name)
  return { container, button }
}

describe('the room when the host offers a choice', () => {
  it('shows the suggested team and files the request there when the person sends it', async () => {
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'other-team', teamId: 'wh' }
    })
    client.fileBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { container, button } = await mountRoom()
    expect(container.textContent).toContain(
      'Choose where this task goes: Send to Warehouse, or keep it in Marketing.'
    )
    expect(container.textContent).not.toContain('Who should take this?')
    await act(async () => button('Send to Warehouse')?.click())
    expect(client.fileBotTeamRequest).toHaveBeenCalledWith({
      teamId: 'mk',
      text: 'Check inventory',
      toTeamId: 'wh',
      start: true,
      askProject: true
    })
    expect(container.textContent).not.toContain('Choose where this task goes')
  })

  it('keeps the request in this team when the person keeps it', async () => {
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'other-team', teamId: 'wh' }
    })
    client.fileBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { button } = await mountRoom()
    await act(async () => button('Keep in Marketing')?.click())
    expect(client.fileBotTeamRequest).toHaveBeenCalledWith({
      teamId: 'mk',
      text: 'Check inventory',
      start: true,
      askProject: true
    })
  })

  it('preselects the bot the host suggests for a new-bot choice, not the first on the team', async () => {
    const duo: BotTeam = {
      ...TEAM,
      bots: [
        { ...TEAM.bots[0], id: 'iris', name: 'Iris', job: 'Designs flyers' },
        { ...TEAM.bots[0], id: 'max', name: 'Max', job: 'Writes copy' }
      ]
    }
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'new-bot', suggestedBotId: 'max' }
    })
    const { button } = await mountRoom({ team: duo })
    expect(button('Send to Max')).toBeDefined()
    expect(button('Send to Iris')).toBeUndefined()
  })

  it('asks which project a request is for, offering the team projects and No project', async () => {
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'project', botId: 'iris' }
    })
    client.fileBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { container, button } = await mountRoom(
      {},
      { projects: [{ id: 'nexus', teamId: 'mk', name: 'NexusCare', goal: '' }] }
    )
    expect(container.textContent).toContain('Which project is this for?')
    expect(container.textContent).toContain('No project')
    const option = [...container.querySelectorAll('label')].find(
      (label) => label.textContent === 'NexusCare'
    )
    await act(async () => option?.click())
    await act(async () => button('Continue')?.click())
    expect(client.fileBotTeamRequest).toHaveBeenCalledWith({
      teamId: 'mk',
      text: 'Check inventory',
      botId: 'iris',
      projectId: 'nexus',
      start: true,
      askProject: true
    })
  })

  it('shows a task under only its owner name, not the job the owner was given', async () => {
    const { container } = await mountRoom(
      {},
      {
        tasks: [
          {
            id: 'task_1',
            teamId: 'mk',
            title: 'Make a flyer',
            prompt: 'Make a flyer',
            ownerBotId: 'iris',
            sessionId: null,
            projectId: null
          }
        ]
      }
    )
    expect(container.textContent).toContain('Make a flyer')
    expect(container.textContent).not.toContain('Designs flyers')
  })

  it('opens the add-bot form for a new bot and the new-team form for a new team', async () => {
    const onCreateBot = vi.fn()
    const onCreateTeam = vi.fn()
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'new-bot' }
    })
    const first = await mountRoom({ onCreateBot, onCreateTeam })
    await act(async () => first.button('Create a new bot')?.click())
    expect(onCreateBot).toHaveBeenCalledTimes(1)
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'new-team' }
    })
    const second = await mountRoom({ onCreateBot, onCreateTeam })
    await act(async () => second.button('Create a new team')?.click())
    expect(onCreateTeam).toHaveBeenCalledTimes(1)
  })

  it('still asks who should take it when the host sent no choice', async () => {
    client.postBotTeamRequest.mockResolvedValue({ task: null, startError: null })
    const { container } = await mountRoom()
    expect(container.textContent).toContain('Who should take this?')
  })

  it('does not ask who should take it when a bot already answered in the room', async () => {
    client.postBotTeamRequest.mockResolvedValue({ task: null, startError: null, answered: true })
    const { container } = await mountRoom()
    expect(container.textContent).not.toContain('Who should take this?')
  })

  it('says where a request went when the person named another team with @', async () => {
    client.postBotTeamRequest.mockResolvedValue({
      task: { id: 't' },
      startError: null,
      sentTo: { teamId: 'wh', teamName: 'Warehouse' }
    })
    await mountRoom()
    expect(toasts.success).toHaveBeenCalledWith('Sent to Warehouse')
  })
})
