import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Bot: 'Bot',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  Ellipsis: 'Ellipsis',
  MessageSquare: 'MessageSquare'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('../hooks/use-mobile-dictation', () => ({
  useMobileDictation: () => ({ isRecording: false, start: vi.fn(), stop: vi.fn() })
}))
vi.mock('../session/MobileNativeChatComposer', () => ({ MobileNativeChatComposer: 'Composer' }))
vi.mock('../session/MobileNativeChatMessage', () => ({ MobileNativeChatMessage: 'ChatMessage' }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
  })
}))

const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [
    {
      id: 'bot',
      name: 'Iris',
      job: '',
      agent: 'claude' as const,
      modelMode: 'auto' as const,
      model: null,
      effort: null,
      skills: []
    }
  ]
}
const TASK = {
  id: 'task',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: null as string | null
}

function hostAnswering(room: object, post: object = {}) {
  const sendRequest = vi.fn(async (method: string) =>
    method === 'botTeams.listRoom'
      ? { ok: true, result: room }
      : { ok: true, result: { task: TASK, startError: null, ...post } }
  )
  return { sendRequest }
}

async function render(
  client: { sendRequest: unknown },
  onOpenTask = vi.fn(),
  onOpenBots = vi.fn(),
  onBack = vi.fn()
) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamRoom, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The room only calls sendRequest and the mocked status feed.
        client: client as never,
        team: TEAM,
        teams: [TEAM],
        onBack,
        onPickTeam: vi.fn(),
        onOpenBots,
        onOpenTask
      })
    )
  })
  return renderer
}

const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamRoom', () => {
  it('sends through the chat composer and starts the bot', async () => {
    const client = hostAnswering({ tasks: [], messages: [], workspaceId: null })
    const renderer = await render(client)
    const composer = renderer.root.findByType('Composer' as never)
    expect(composer.props.placeholder).toBe('Message the team')

    await act(async () => {
      await composer.props.onSend('Hi')
    })

    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.postMessage',
      { teamId: 'team', text: 'Hi', start: true },
      expect.anything()
    )
  })

  it('reaches the bots from the room menu and goes back', async () => {
    const client = hostAnswering({ tasks: [], messages: [], workspaceId: null })
    const onOpenBots = vi.fn()
    const onBack = vi.fn()
    const renderer = await render(client, vi.fn(), onOpenBots, onBack)

    await press(renderer, 'Back')
    expect(onBack).toHaveBeenCalled()
    await press(renderer, 'Room menu')
    await press(renderer, 'Bots')
    expect(onOpenBots).toHaveBeenCalled()
  })

  it('locks the composer when the host stops answering', async () => {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamRoom, {
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The room only calls sendRequest and the mocked status feed.
          client: hostAnswering({ tasks: [], messages: [], workspaceId: null }) as never,
          team: TEAM,
          teams: [TEAM],
          offline: true,
          onBack: vi.fn(),
          onPickTeam: vi.fn(),
          onOpenBots: vi.fn(),
          onOpenTask: vi.fn()
        })
      )
    })
    expect(renderer.root.findByType('Composer' as never).props.disabled).toBe(true)
  })

  it('starts a waiting task and opens a started one in its workspace', async () => {
    const started = { ...TASK, id: 'task2', title: 'Poster', sessionId: 's' }
    const client = hostAnswering({ tasks: [TASK, started], messages: [], workspaceId: 'folder:1' })
    const onOpenTask = vi.fn()
    const renderer = await render(client, onOpenTask)

    await press(renderer, 'Start Flyer')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.startTask',
      { taskId: 'task' },
      expect.anything()
    )

    await press(renderer, 'Open Poster')
    expect(onOpenTask).toHaveBeenCalledWith('folder:1', started)
  })

  it('asks who takes a request when the host gives it to no bot', async () => {
    const client = hostAnswering({ tasks: [], messages: [], workspaceId: null }, { task: null })
    const renderer = await render(client)

    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Hi')
    })

    expect(JSON.stringify(renderer.toJSON())).toContain('Who should take this?')
  })
})
