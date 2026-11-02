import { createElement, type ComponentProps } from 'react'
import { Alert } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
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
  Brain: 'Brain',
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  Ellipsis: 'Ellipsis',
  FileText: 'FileText',
  Folder: 'Folder',
  FolderPlus: 'FolderPlus',
  LayoutGrid: 'LayoutGrid',
  MessageSquare: 'MessageSquare'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  cancelAnimation: () => {},
  useAnimatedStyle: (style: () => object) => style(),
  useSharedValue: (value: number) => ({ value }),
  withDelay: (_delay: number, value: unknown) => value,
  withRepeat: (value: unknown) => value,
  withSequence: (...values: unknown[]) => values[0],
  withTiming: (value: number) => value
}))
vi.mock('../onboarding/use-reduced-motion', () => ({ useReducedMotionEnabled: () => false }))
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
  sessionId: null as string | null,
  projectId: null
}

function hostWithFiles(room: object, paths: string[]) {
  const sendRequest = vi.fn(async (method: string) => {
    if (method === 'botTeams.listRoom') {
      return { ok: true, result: room }
    }
    if (method === 'files.searchPaths') {
      return { ok: true, result: { files: paths.map((relativePath) => ({ relativePath })) } }
    }
    return { ok: true, result: { task: TASK, startError: null } }
  })
  return { sendRequest }
}

/** `post` is the reply to a posted request only; filing and starting always return the task. */
function hostAnswering(room: object, post: object = {}) {
  const sendRequest = vi.fn(async (method: string) => {
    if (method === 'botTeams.listRoom') {
      return { ok: true, result: room }
    }
    if (method === 'botTeams.postMessage') {
      return { ok: true, result: { task: TASK, startError: null, ...post } }
    }
    return { ok: true, result: { task: TASK, startError: null } }
  })
  return { sendRequest }
}

const PROJECT = {
  id: 'project',
  teamId: 'team',
  name: 'Launch',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}

const OTHER_TEAM = {
  ...TEAM,
  id: 'team_2',
  name: 'Warehouse',
  purpose: 'Stock and shipping',
  character: 'square' as const,
  bots: [{ ...TEAM.bots[0], id: 'max', name: 'Max', job: 'Stock' }]
}

/** Every request the room files answers with a refusal, and the room reads as before. */
function hostRefusingFilings(post: object) {
  const sendRequest = vi.fn(async (method: string) => {
    if (method === 'botTeams.listRoom') {
      return { ok: true, result: { tasks: [], messages: [], projects: [], workspaceId: null } }
    }
    if (method === 'botTeams.postMessage') {
      return { ok: true, result: { task: null, startError: null, ...post } }
    }
    return { ok: false, error: { code: 'internal', message: 'nope' } }
  })
  return { sendRequest }
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

async function render(
  client: { sendRequest: unknown },
  onOpenTask = vi.fn(),
  onOpenBots = vi.fn(),
  onBack = vi.fn(),
  extra: Partial<ComponentProps<typeof MobileBotTeamRoom>> = {}
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
        onOpenTask,
        onOpenWork: vi.fn(),
        onAddBot: vi.fn(),
        onNewTeam: vi.fn(),
        ...extra
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

  it('clears the composer at once, and puts the text back when the send fails', async () => {
    const client = hostAnswering({ tasks: [], messages: [], workspaceId: null })
    let answer: (reply: object) => void = () => {}
    const listRoom = client.sendRequest.getMockImplementation()!
    client.sendRequest.mockImplementation(async (method: string) =>
      method === 'botTeams.postMessage'
        ? new Promise((resolve) => (answer = resolve))
        : listRoom(method)
    )
    const renderer = await render(client)
    const composer = () => renderer.root.findByType('Composer' as never)
    await act(async () => composer().props.onChangeText('Hi'))
    let sending!: Promise<boolean>
    await act(async () => {
      sending = composer().props.onSend('Hi')
    })
    expect(composer().props.value).toBe('')
    expect(
      renderer.root.findAll((node) => node.children.includes('All is typing'))
    ).not.toHaveLength(0)
    await act(async () => {
      answer({ ok: false, error: { code: 'unavailable', message: 'gone' } })
      await sending
    })
    expect(composer().props.value).toBe('Hi')
    expect(renderer.root.findAll((node) => node.children.includes('All is typing'))).toHaveLength(0)
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

  it('reaches the team board, a project and a new project from the room menu', async () => {
    const client = hostAnswering({
      tasks: [],
      messages: [],
      projects: [PROJECT],
      workspaceId: null
    })
    const onOpenWork = vi.fn()
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), { onOpenWork })
    await press(renderer, 'Room menu')
    await press(renderer, 'Team board')
    expect(onOpenWork).toHaveBeenLastCalledWith({ name: 'board', teamId: 'team' })
    await press(renderer, 'Room menu')
    await press(renderer, 'Launch')
    expect(onOpenWork).toHaveBeenLastCalledWith({
      name: 'project',
      teamId: 'team',
      projectId: 'project',
      tab: 'board'
    })
    await press(renderer, 'Room menu')
    await press(renderer, 'New project')
    expect(onOpenWork).toHaveBeenLastCalledWith({ name: 'newProject', teamId: 'team' })
  })

  it('offers the team files after the bots while an @ mention is typed', async () => {
    const client = hostWithFiles(
      { tasks: [], messages: [], projects: [], workspaceId: 'folder:1' },
      ['flyer.md']
    )
    const renderer = await render(client)
    await act(async () => {
      renderer.root.findByType('Composer' as never).props.onNeedFiles('fly')
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
    const suggestions = renderer.root
      .findByType('Composer' as never)
      .props.customSuggestions('@fly', 4)
    expect(suggestions.map((item: { label: string }) => item.label)).toEqual(['flyer.md'])
  })

  it('lists the other teams after the bots, and @Team inserts the team name', async () => {
    const client = hostWithFiles(
      { tasks: [], messages: [], projects: [], workspaceId: 'folder:1' },
      ['flyer.md']
    )
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await act(async () => {
      renderer.root.findByType('Composer' as never).props.onNeedFiles('')
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
    const suggestions = renderer.root
      .findByType('Composer' as never)
      .props.customSuggestions('@', 1)
    expect(suggestions.map((item: { label: string }) => item.label)).toEqual([
      'Iris',
      'Warehouse',
      'flyer.md'
    ])
    expect(suggestions[1].insert).toBe('@Warehouse ')
    expect(
      renderer.root.findByType('Composer' as never).props.customSuggestions('@war', 4)
    ).toEqual([expect.objectContaining({ label: 'Warehouse', insert: '@Warehouse ' })])
  })

  it('reaches the team memory from the room menu', async () => {
    const client = hostAnswering({ tasks: [], messages: [], projects: [], workspaceId: null })
    const onOpenWork = vi.fn()
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), { onOpenWork })
    await press(renderer, 'Room menu')
    await press(renderer, 'Memory')
    expect(onOpenWork).toHaveBeenLastCalledWith({ name: 'memory', teamId: 'team' })
  })

  it('reaches the team files from the room menu', async () => {
    const client = hostAnswering({ tasks: [], messages: [], projects: [], workspaceId: null })
    const onOpenWork = vi.fn()
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), { onOpenWork })
    await press(renderer, 'Room menu')
    await press(renderer, 'Files')
    expect(onOpenWork).toHaveBeenLastCalledWith({ name: 'files', teamId: 'team' })
  })

  it("shows a team greeting from All, with every bot's icon", async () => {
    const twoBots = {
      ...TEAM,
      bots: [TEAM.bots[0], { ...TEAM.bots[0], id: 'bot_2', name: 'Max' }]
    }
    const client = hostAnswering({
      tasks: [],
      messages: [{ id: 'm1', teamId: 'team', authorBotId: 'all', text: 'Hola!' }],
      projects: [],
      workspaceId: null
    })
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), { team: twoBots })
    expect(JSON.stringify(renderer.toJSON())).toContain('All')
    expect(renderer.root.findAll((node) => node.type === MobileBotAgentIcon)).toHaveLength(2)
  })

  it('does not ask who takes a greeting that a team answered', async () => {
    const client = hostAnswering(
      { tasks: [], messages: [], projects: [], workspaceId: null },
      { task: null, greeted: true }
    )
    const renderer = await render(client)
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Hola')
    })
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Who should take this?')
  })

  it('counts the open work and the tasks on the room menu', async () => {
    const client = hostAnswering({ tasks: [TASK], messages: [], projects: [], workspaceId: null })
    const renderer = await render(client)
    await press(renderer, 'Room menu')
    const menu = JSON.stringify(renderer.toJSON())
    expect(menu).toContain('1 open')
    expect(menu).toContain('1 task')
    expect(menu).not.toContain('1 tasks')
  })

  it('offers the suggested team, and files the request there when the person sends it', async () => {
    const client = hostAnswering(
      { tasks: [], messages: [], projects: [], workspaceId: null },
      { task: null, choice: { kind: 'other-team', teamId: 'team_2' } }
    )
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Inventory?')
    })
    const card = JSON.stringify(renderer.toJSON())
    expect(card).toContain(
      'Choose where this task goes: Send to Warehouse, or keep it in Marketing.'
    )
    expect(card).not.toContain('Who should take this?')

    await press(renderer, 'Send to Warehouse')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team', text: 'Inventory?', start: true, toTeamId: 'team_2' },
      expect.anything()
    )
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Choose where this task goes')
  })

  it('keeps the request in the team when the person picks Keep', async () => {
    const client = hostAnswering(
      { tasks: [], messages: [], projects: [], workspaceId: null },
      { task: null, choice: { kind: 'other-team', teamId: 'team_2' } }
    )
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Hi')
    })
    await press(renderer, 'Keep in Marketing')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team', text: 'Hi', start: true },
      expect.anything()
    )
  })

  it('offers the bots of the team, and opens the add-bot form from the choice', async () => {
    const client = hostAnswering(
      { tasks: [], messages: [], projects: [], workspaceId: null },
      { task: null, choice: { kind: 'new-bot' } }
    )
    const onAddBot = vi.fn()
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), { onAddBot })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Hi')
    })
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Choose who takes this task: create a new bot, or send it to an existing bot.'
    )
    await press(renderer, 'Create a new bot')
    expect(onAddBot).toHaveBeenCalled()
    await press(renderer, 'Send to Iris')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team', text: 'Hi', start: true, botId: 'bot' },
      expect.anything()
    )
  })

  it('offers a new team or an existing one for a request that fits no team', async () => {
    const client = hostAnswering(
      { tasks: [], messages: [], projects: [], workspaceId: null },
      { task: null, choice: { kind: 'new-team' } }
    )
    const onNewTeam = vi.fn()
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM],
      onNewTeam
    })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Taxes')
    })
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Choose where this task goes: create a new team, or send it to an existing team.'
    )
    await press(renderer, 'Create a new team')
    expect(onNewTeam).toHaveBeenCalled()
    await press(renderer, 'Send to Warehouse')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.assignRequest',
      { teamId: 'team', text: 'Taxes', start: true, toTeamId: 'team_2' },
      expect.anything()
    )
  })

  it('says the request did not send when the host refuses it', async () => {
    vi.mocked(Alert.alert).mockClear()
    const client = hostRefusingFilings({ choice: { kind: 'new-team' } })
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Taxes')
    })
    await press(renderer, 'Send to Warehouse')
    await settle()
    expect(Alert.alert).toHaveBeenCalledWith(
      'That did not send',
      'Check the connection to this host and try again.'
    )
    expect(JSON.stringify(renderer.toJSON())).toContain('Choose where this task goes')
  })

  it('says the host cannot route requests when it predates the method', async () => {
    vi.mocked(Alert.alert).mockClear()
    const client = {
      sendRequest: vi.fn(async (method: string) => {
        if (method === 'botTeams.listRoom') {
          return { ok: true, result: { tasks: [], messages: [], projects: [], workspaceId: null } }
        }
        if (method === 'botTeams.postMessage') {
          return {
            ok: true,
            result: { task: null, startError: null, choice: { kind: 'new-team' } }
          }
        }
        return { ok: false, error: { code: 'method_not_found', message: 'nope' } }
      })
    }
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await act(async () => {
      await renderer.root.findByType('Composer' as never).props.onSend('Taxes')
    })
    await press(renderer, 'Send to Warehouse')
    await settle()
    expect(Alert.alert).toHaveBeenCalledWith(
      'That did not send',
      'This host cannot route requests yet.'
    )
  })

  it('says the host cannot move tasks when it predates the method', async () => {
    vi.mocked(Alert.alert).mockClear()
    const client = {
      sendRequest: vi.fn(async (method: string) =>
        method === 'botTeams.listRoom'
          ? { ok: true, result: { tasks: [TASK], messages: [], projects: [], workspaceId: null } }
          : { ok: false, error: { code: 'method_not_found', message: 'nope' } }
      )
    }
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await press(renderer, 'Reassign')
    await press(renderer, 'Give to Max')
    await settle()
    expect(Alert.alert).toHaveBeenCalledWith(
      'That did not save',
      'This host cannot move tasks yet.'
    )
  })

  it('hands an idle task to a bot of another team and reads the room again', async () => {
    const client = hostAnswering({
      tasks: [TASK],
      messages: [],
      projects: [],
      workspaceId: null
    })
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await press(renderer, 'Reassign')
    const sheet = JSON.stringify(renderer.toJSON())
    expect(sheet).toContain('Who should own Flyer?')
    expect(sheet).toContain('The new owner reads the task so far and continues from there.')
    expect(sheet).toContain('Warehouse, Stock')
    expect(sheet).not.toContain('Give to Iris')

    const reads = client.sendRequest.mock.calls.filter(([m]) => m === 'botTeams.listRoom').length
    await press(renderer, 'Give to Max')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.reassignTask',
      { taskId: 'task', botId: 'max', start: true },
      expect.anything()
    )
    expect(
      client.sendRequest.mock.calls.filter(([m]) => m === 'botTeams.listRoom').length
    ).toBeGreaterThan(reads)
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Who should own')
  })

  it('closes the reassign sheet on Cancel without handing anything over', async () => {
    const client = hostAnswering({
      tasks: [TASK],
      messages: [],
      projects: [],
      workspaceId: null
    })
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await press(renderer, 'Reassign')
    await press(renderer, 'Cancel')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Who should own')
    expect(client.sendRequest).not.toHaveBeenCalledWith(
      'botTeams.reassignTask',
      expect.anything(),
      expect.anything()
    )
  })

  it('does not offer Reassign for a task that is working', async () => {
    const working = { ...TASK, id: 'task3', title: 'Poster', sessionId: 's' }
    const client = hostAnswering({
      tasks: [working],
      messages: [],
      projects: [],
      workspaceId: 'folder:1'
    })
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Reassign')
  })

  it('says the task did not move when the host refuses the hand-over', async () => {
    vi.mocked(Alert.alert).mockClear()
    const client = {
      sendRequest: vi.fn(async (method: string) =>
        method === 'botTeams.listRoom'
          ? { ok: true, result: { tasks: [TASK], messages: [], projects: [], workspaceId: null } }
          : { ok: false, error: { code: 'internal', message: 'nope' } }
      )
    }
    const renderer = await render(client, vi.fn(), vi.fn(), vi.fn(), {
      teams: [TEAM, OTHER_TEAM]
    })
    await press(renderer, 'Reassign')
    await press(renderer, 'Give to Max')
    await settle()
    expect(Alert.alert).toHaveBeenCalledWith(
      'That did not save',
      'Check the connection to this host and try again.'
    )
  })
})
