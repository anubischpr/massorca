import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamProject } from './MobileBotTeamProject'

vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
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
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
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
  workspacesEnabled: true,
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
const PROJECT = {
  id: 'project',
  teamId: 'team',
  name: 'Launch',
  goal: 'Ship the flyer',
  codeSource: null,
  brief: {
    requirements: ['Flyer for the offers'],
    constraints: ['Nothing is sent without OK'],
    decisions: []
  },
  briefUpdatedAt: Date.UTC(2026, 10, 1, 12, 0)
}
const TODO = {
  id: 'task_1',
  teamId: 'team',
  title: 'Flyer',
  prompt: '',
  ownerBotId: 'bot',
  sessionId: null,
  projectId: 'project'
}

type Props = ComponentProps<typeof MobileBotTeamProject>

function hostReplying(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The project only calls sendRequest.
  return { sendRequest, client: { sendRequest } as never as Props['client'] }
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    client: hostReplying({ ok: true, result: { project: PROJECT } }).client,
    team: TEAM,
    project: PROJECT,
    tasks: [TODO],
    tab: 'board',
    offline: false,
    workspaceId: 'folder:1',
    onBack: vi.fn(),
    onTab: vi.fn(),
    onOpenTask: vi.fn(),
    onChanged: vi.fn(),
    ...overrides
  }
}

async function render(props: Props): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamProject, props))
  })
  return renderer
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamProject', () => {
  it('offers Connect to code only when the team has Workspaces on', async () => {
    const off = await render(baseProps({ team: { ...TEAM, workspacesEnabled: false } }))
    expect(text(off)).not.toContain('Connect to code')
    const on = await render(baseProps())
    expect(text(on)).toContain('Not connected to code')
  })

  it('connects the project to the chosen source and reads it again', async () => {
    const connected = { ...PROJECT, codeSource: 'repo' as const }
    const { client, sendRequest } = hostReplying({ ok: true, result: { project: connected } })
    const onChanged = vi.fn()
    const renderer = await render(baseProps({ client, onChanged }))

    await press(renderer, 'Connect to code')
    expect(text(renderer)).toContain('Existing repository')
    expect(text(renderer)).toContain('New folder with git')
    await press(renderer, 'Connect')

    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.setProjectCodeSource',
      { projectId: 'project', codeSource: 'repo' },
      expect.anything()
    )
    expect(onChanged).toHaveBeenCalled()
    await act(async () => {
      renderer.update(
        createElement(MobileBotTeamProject, baseProps({ client, project: connected }))
      )
    })
    expect(text(renderer)).toContain('Connected to code: Existing repository.')
    expect(text(renderer)).not.toContain('Not connected to code')
  })

  it('says when the host cannot connect projects to code yet', async () => {
    const { client } = hostReplying({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    const renderer = await render(baseProps({ client }))
    await press(renderer, 'Connect to code')
    await press(renderer, 'Connect')
    expect(text(renderer)).toContain('This host cannot connect projects to code yet.')
  })

  it('reads the brief without any way to edit it', async () => {
    const renderer = await render(baseProps({ tab: 'brief' }))
    const content = text(renderer)
    expect(content).toContain('Ship the flyer')
    expect(content).toContain('Flyer for the offers')
    expect(content).toContain('Not linked yet')
    expect(content).toContain('Nothing is sent without OK')
    expect(content).toContain('by you.')
    expect(renderer.root.findAll((node) => node.type === 'TextInput')).toHaveLength(0)
  })

  it('says when the brief has no requirements', async () => {
    const empty = { ...PROJECT, brief: { ...PROJECT.brief, requirements: [] } }
    const renderer = await render(baseProps({ tab: 'brief', project: empty }))
    expect(text(renderer)).toContain('No requirements yet.')
  })

  it('shows the cards of the chosen column', async () => {
    const renderer = await render(baseProps())
    expect(text(renderer)).toContain('Nothing in this column yet.')
    await press(renderer, 'Todo 1')
    expect(text(renderer)).toContain('Flyer')
  })
})
