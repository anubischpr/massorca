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
  assignBotTeamRequest: vi.fn()
}))

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom: client.listBotTeamRoom,
  postBotTeamRequest: client.postBotTeamRequest,
  setBotTeamTaskProject: vi.fn(),
  startBotTeamTask: vi.fn()
}))
vi.mock('@/runtime/runtime-bot-team-routing-client', () => ({
  assignBotTeamRequest: client.assignBotTeamRequest
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

async function mountRoom(props: Partial<Parameters<typeof BotTeamRoom>[0]> = {}) {
  client.listBotTeamRoom.mockResolvedValue({ messages: [], tasks: [], projects: [] })
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
    client.assignBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { container, button } = await mountRoom()
    expect(container.textContent).toContain(
      'Choose where this task goes: Send to Warehouse, or keep it in Marketing.'
    )
    expect(container.textContent).not.toContain('Who should take this?')
    await act(async () => button('Send to Warehouse')?.click())
    expect(client.assignBotTeamRequest).toHaveBeenCalledWith({
      teamId: 'mk',
      text: 'Check inventory',
      toTeamId: 'wh',
      start: true
    })
    expect(container.textContent).not.toContain('Choose where this task goes')
  })

  it('keeps the request in this team when the person keeps it', async () => {
    client.postBotTeamRequest.mockResolvedValue({
      task: null,
      startError: null,
      choice: { kind: 'other-team', teamId: 'wh' }
    })
    client.assignBotTeamRequest.mockResolvedValue({ task: { id: 't' }, startError: null })
    const { button } = await mountRoom()
    await act(async () => button('Keep in Marketing')?.click())
    expect(client.assignBotTeamRequest).toHaveBeenCalledWith({
      teamId: 'mk',
      text: 'Check inventory',
      start: true
    })
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
