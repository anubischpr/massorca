import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamNewProject } from './MobileBotTeamNewProject'
import { MobileBotTeamProject } from './MobileBotTeamProject'
import { MobileBotTeamProjectTeams } from './MobileBotTeamProjectTeams'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Lock: 'Lock',
  Plus: 'Plus',
  X: 'X'
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
  })
}))

function team(
  id: string,
  name: string,
  character: 'circle' | 'square',
  botId: string,
  bot: string
) {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'full-access' as const,
    bots: [
      {
        id: botId,
        name: bot,
        job: '',
        agent: 'claude' as const,
        modelMode: 'auto' as const,
        model: null,
        effort: null,
        skills: []
      }
    ]
  }
}
const MARKETING = team('t1', 'Marketing', 'circle', 'b1', 'Nora')
const DEVELOPMENT = team('t2', 'Development', 'square', 'b2', 'Max')

const PROJECT = {
  id: 'p1',
  teamId: 't1',
  name: 'NexusCare',
  goal: '',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null,
  archivedAt: null,
  linkedTeamIds: ['t2']
}

function hostReplying(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The screens only call sendRequest.
  return { sendRequest, client: { sendRequest } as never }
}

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(element)
  })
  return renderer
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

function pressable(renderer: ReactTestRenderer, label: string) {
  const found = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )
  if (found.length === 0) {
    throw new Error(`Nothing to press for ${label}`)
  }
  return found[0]
}
const press = (renderer: ReactTestRenderer, label: string) =>
  act(async () => pressable(renderer, label).props.onPress())

describe('the Teams field', () => {
  it('shows the owner fixed, lets a team be added, and unlinks one with the x', async () => {
    const onChange = vi.fn()
    const renderer = await render(
      createElement(MobileBotTeamProjectTeams, {
        owner: MARKETING,
        linkedTeamIds: [],
        teams: [MARKETING, DEVELOPMENT],
        editing: true,
        onChange
      })
    )
    expect(text(renderer)).toContain('Marketing, owner')
    expect(text(renderer)).toContain('The owner team cannot be removed')
    await press(renderer, 'Add team')
    await press(renderer, 'Add Development')
    expect(onChange).toHaveBeenCalledWith(['t2'])

    const linked = await render(
      createElement(MobileBotTeamProjectTeams, {
        owner: MARKETING,
        linkedTeamIds: ['t2'],
        teams: [MARKETING, DEVELOPMENT],
        editing: true,
        onChange
      })
    )
    await press(linked, 'Unlink Development')
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})

describe('a new project with teams', () => {
  it('creates the project linked to the teams added', async () => {
    const { client, sendRequest } = hostReplying({ ok: true, result: { project: PROJECT } })
    const renderer = await render(
      createElement(MobileBotTeamNewProject, {
        client,
        team: MARKETING,
        renderTeams: (field: {
          linkedTeamIds: string[]
          disabled: boolean
          onChange: (ids: string[]) => void
        }) =>
          createElement(MobileBotTeamProjectTeams, {
            owner: MARKETING,
            teams: [MARKETING, DEVELOPMENT],
            editing: false,
            ...field
          }),
        onCancel: vi.fn(),
        onCreated: vi.fn()
      })
    )
    await act(async () =>
      renderer.root.findByProps({ accessibilityLabel: 'Name' }).props.onChangeText('NexusCare')
    )
    await press(renderer, 'Add team')
    await press(renderer, 'Add Development')
    await press(renderer, 'Create project')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.createProject',
      expect.objectContaining({ teamId: 't1', name: 'NexusCare', linkedTeamIds: ['t2'] }),
      expect.anything()
    )
  })

  it('shows no Teams field when the screen is not given one, as before', async () => {
    const renderer = await render(
      createElement(MobileBotTeamNewProject, {
        client: hostReplying({ ok: true }).client,
        team: MARKETING,
        onCancel: vi.fn(),
        onCreated: vi.fn()
      })
    )
    expect(text(renderer)).not.toContain('Marketing, owner')
  })
})

describe('the board of a shared project', () => {
  const tasks = [
    {
      id: 'k1',
      teamId: 't2',
      title: 'Booking page',
      prompt: '',
      ownerBotId: 'b2',
      sessionId: null,
      projectId: 'p1'
    }
  ]
  const otherTeamsTask = {
    id: 'k2',
    teamId: 't1',
    title: 'Launch email',
    prompt: '',
    ownerBotId: 'b1',
    sessionId: null,
    projectId: 'p1'
  }

  const props = {
    client: hostReplying({ ok: true }).client,
    team: DEVELOPMENT,
    teams: [MARKETING, DEVELOPMENT],
    project: PROJECT,
    tasks,
    tab: 'board' as const,
    offline: false,
    workspaceId: 'folder:1',
    onBack: vi.fn(),
    onTab: vi.fn(),
    onOpenTask: vi.fn(),
    onChanged: vi.fn()
  }

  it('names the owner team and the team of each task, including tasks the other team made', async () => {
    const renderer = await render(
      createElement(MobileBotTeamProject, { ...props, projectTasks: [otherTeamsTask] })
    )
    expect(text(renderer)).toContain('Owner')
    expect(text(renderer)).toContain('Marketing')
    // The default column is In Progress; both tasks are Not started, so look at Todo.
    await press(renderer, 'Todo 2')
    expect(text(renderer)).toContain('Booking page')
    expect(text(renderer)).toContain('Launch email')
    expect(text(renderer)).toContain('Development')
    expect(text(renderer)).toContain('Nora')
  })

  it('names no team on a project that is not shared', async () => {
    const renderer = await render(
      createElement(MobileBotTeamProject, {
        ...props,
        team: MARKETING,
        project: { ...PROJECT, linkedTeamIds: [] },
        tasks: [otherTeamsTask]
      })
    )
    await press(renderer, 'Todo 1')
    expect(text(renderer)).not.toContain('Owner')
  })
})
