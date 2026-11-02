import { createElement, type ComponentProps } from 'react'
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

function hostAnswering(room: object, post: object = {}) {
  const sendRequest = vi.fn(async (method: string) =>
    method === 'botTeams.listRoom'
      ? { ok: true, result: room }
      : { ok: true, result: { task: TASK, startError: null, ...post } }
  )
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
    expect(menu).toContain('1 tasks')
  })
})
