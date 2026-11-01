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
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
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
  bots: [{ id: 'bot', name: 'Iris', job: '', agent: 'claude' as const }]
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

async function render(client: { sendRequest: unknown }, onOpenTask = vi.fn()) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamRoom, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The room only calls sendRequest and the mocked status feed.
        client: client as never,
        team: TEAM,
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
  it('saves a request to Todo without starting a bot', async () => {
    const client = hostAnswering({ tasks: [], messages: [], workspaceId: null })
    const renderer = await render(client)
    act(() =>
      renderer.root.findByProps({ accessibilityLabel: 'Message the team' }).props.onChangeText('Hi')
    )

    await press(renderer, 'Save to Todo')

    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.postMessage',
      { teamId: 'team', text: 'Hi', start: false },
      expect.anything()
    )
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
    act(() =>
      renderer.root.findByProps({ accessibilityLabel: 'Message the team' }).props.onChangeText('Hi')
    )

    await press(renderer, 'Send')

    expect(JSON.stringify(renderer.toJSON())).toContain('Who should take this?')
  })
})
