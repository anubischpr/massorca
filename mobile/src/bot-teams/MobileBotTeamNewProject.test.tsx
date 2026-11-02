import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamNewProject } from './MobileBotTeamNewProject'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))

const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: []
}
const PROJECT = {
  id: 'project_9',
  teamId: 'team',
  name: 'Launch',
  goal: 'Ship the flyer',
  codeSource: null,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}

type Props = ComponentProps<typeof MobileBotTeamNewProject>

function hostReplying(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The form only calls sendRequest.
  return { sendRequest, client: { sendRequest } as never as Props['client'] }
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    client: hostReplying({ ok: true, result: { project: PROJECT } }).client,
    team: TEAM,
    onCancel: vi.fn(),
    onCreated: vi.fn(),
    ...overrides
  }
}

async function render(props: Props): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamNewProject, props))
  })
  return renderer
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())
const nameInput = (renderer: ReactTestRenderer) =>
  renderer.root.findByProps({ accessibilityLabel: 'Name' })
const goalInput = (renderer: ReactTestRenderer) =>
  renderer.root.findByProps({ accessibilityLabel: 'Goal' })
const createButton = (renderer: ReactTestRenderer) =>
  renderer.root.findByProps({ accessibilityLabel: 'Create project' })

const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamNewProject', () => {
  it('keeps Create project off until the project has a name', async () => {
    const renderer = await render(baseProps())
    expect(createButton(renderer).props.disabled).toBe(true)
    await act(async () => nameInput(renderer).props.onChangeText('Launch'))
    expect(createButton(renderer).props.disabled).toBe(false)
  })

  it('creates the project with its name and goal, then hands it over', async () => {
    const { client, sendRequest } = hostReplying({ ok: true, result: { project: PROJECT } })
    const onCreated = vi.fn()
    const renderer = await render(baseProps({ client, onCreated }))
    await act(async () => nameInput(renderer).props.onChangeText('Launch'))
    await act(async () => goalInput(renderer).props.onChangeText('Ship the flyer'))
    await press(renderer, 'Create project')

    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.createProject',
      { teamId: 'team', name: 'Launch', goal: 'Ship the flyer', codeSource: null },
      expect.anything()
    )
    expect(onCreated).toHaveBeenCalledWith(PROJECT)
  })

  it('asks for a source only when the team has Workspaces on', async () => {
    const { client, sendRequest } = hostReplying({ ok: true, result: { project: PROJECT } })
    const renderer = await render(baseProps({ client, team: { ...TEAM, workspacesEnabled: true } }))
    expect(text(renderer)).toContain('Existing repository')
    await act(async () => nameInput(renderer).props.onChangeText('Launch'))
    await press(renderer, 'New folder with git')
    await press(renderer, 'Create project')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.createProject',
      expect.objectContaining({ codeSource: 'folder' }),
      expect.anything()
    )
  })

  it('does not show a source for a team without Workspaces', async () => {
    const renderer = await render(baseProps())
    expect(text(renderer)).not.toContain('Existing repository')
  })

  it('says when the host cannot create projects yet', async () => {
    const { client } = hostReplying({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    const renderer = await render(baseProps({ client }))
    await act(async () => nameInput(renderer).props.onChangeText('Launch'))
    await press(renderer, 'Create project')
    expect(text(renderer)).toContain('This host cannot create projects yet.')
  })
})
