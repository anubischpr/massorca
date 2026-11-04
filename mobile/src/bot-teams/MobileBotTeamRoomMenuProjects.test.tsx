import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'

const alert = vi.hoisted(() => vi.fn())

vi.mock('react-native', () => ({
  Alert: { alert },
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Archive: 'Archive',
  ArchiveRestore: 'ArchiveRestore',
  Bot: 'Bot',
  Brain: 'Brain',
  ChevronLeft: 'ChevronLeft',
  FileText: 'FileText',
  Folder: 'Folder',
  FolderPlus: 'FolderPlus',
  Calendar: 'Calendar',
  LayoutGrid: 'LayoutGrid',
  Link2: 'Link2',
  Lock: 'Lock',
  MessageSquare: 'MessageSquare',
  Pencil: 'Pencil',
  Plus: 'Plus',
  SlidersHorizontal: 'SlidersHorizontal',
  Trash2: 'Trash2',
  X: 'X'
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: 'CharacterIcon' }))

function team(id: string, name: string, character: 'circle' | 'square') {
  return {
    id,
    name,
    purpose: '',
    character,
    workspacesEnabled: false,
    accessMode: 'full-access' as const,
    bots: []
  }
}
const MARKETING = team('t1', 'Marketing', 'circle')
const DEVELOPMENT = team('t2', 'Development', 'square')

function project(fields: Record<string, unknown>) {
  return {
    id: 'p1',
    teamId: 't1',
    name: 'NexusCare',
    goal: '',
    codeSource: null,
    brief: { requirements: [], constraints: [], decisions: [] },
    briefUpdatedAt: null,
    linkedTeamIds: [],
    archivedAt: null,
    ...fields
  }
}

type Props = ComponentProps<typeof MobileBotTeamRoomMenu>

function host(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async () => ({ id: '1', _meta: { runtimeId: 'r' }, ...reply }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The menu only calls sendRequest.
  return { sendRequest, client: { sendRequest } as never as NonNullable<Props['client']> }
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    visible: true,
    onClose: vi.fn(),
    team: MARKETING,
    working: false,
    unreachable: false,
    openCount: 0,
    taskCount: 0,
    projects: [project({})],
    projectTaskCount: () => 4,
    onOpenBoard: vi.fn(),
    onOpenProject: vi.fn(),
    onNewProject: vi.fn(),
    onOpenBots: vi.fn(),
    onOpenFiles: vi.fn(),
    onOpenMemory: vi.fn(),
    ...overrides
  }
}

async function render(props: Props): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamRoomMenu, props))
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

const longPress = (renderer: ReactTestRenderer, title: string) =>
  act(async () => pressable(renderer, title).props.onLongPress())

beforeEach(() => {
  alert.mockReset()
})

describe('the room menu’s projects', () => {
  it('opens a sheet with Edit, Link team, Archive and Delete on a long press', async () => {
    const renderer = await render(baseProps({ client: host({ ok: true }).client }))
    await longPress(renderer, 'NexusCare')
    for (const item of ['Edit', 'Link team', 'Archive', 'Delete']) {
      expect(text(renderer)).toContain(`"${item}"`)
    }
    expect(text(renderer)).not.toContain('"Restore"')
  })

  it('does nothing on a long press without a client, as before', async () => {
    const renderer = await render(baseProps())
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Filters')
    ).toHaveLength(0)
    expect(pressable(renderer, 'NexusCare').props.onLongPress).toBeUndefined()
  })

  it('gives a project another team owns only Edit and Link team, and names its owner', async () => {
    const linked = project({ id: 'p9', teamId: 't2', name: 'Website', linkedTeamIds: ['t1'] })
    const renderer = await render(
      baseProps({
        client: host({ ok: true }).client,
        teams: [MARKETING, DEVELOPMENT],
        projects: [linked]
      })
    )
    expect(text(renderer)).toContain('4 tasks, owner Development')
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Owner: Development')
    ).not.toHaveLength(0)
    await longPress(renderer, 'Website')
    expect(text(renderer)).toContain('"Edit"')
    expect(text(renderer)).toContain('"Link team"')
    expect(text(renderer)).not.toContain('"Archive"')
    expect(text(renderer)).not.toContain('"Delete"')
  })

  it('archives as the owner team and tells the room to read again', async () => {
    const { client, sendRequest } = host({
      ok: true,
      result: { project: project({ archivedAt: 5 }) }
    })
    const onChanged = vi.fn()
    const renderer = await render(baseProps({ client, onChanged }))
    await longPress(renderer, 'NexusCare')
    await press(renderer, 'Archive')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.archiveProject',
      { projectId: 'p1', teamId: 't1', archived: true },
      expect.anything()
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('hides archived projects until Filters turns Show archived on, then offers Restore', async () => {
    const renderer = await render(
      baseProps({ client: host({ ok: true }).client, projects: [project({ archivedAt: 5 })] })
    )
    expect(text(renderer)).not.toContain('NexusCare')
    await press(renderer, 'Filters')
    expect(text(renderer)).toContain('Show archived is on.')
    expect(text(renderer)).toContain('NexusCare')
    expect(text(renderer)).toContain('Archived')
    await longPress(renderer, 'NexusCare')
    expect(text(renderer)).toContain('"Restore"')
    expect(text(renderer)).not.toContain('"Archive"')
  })

  it('asks before deleting, then deletes as the owner team', async () => {
    const { client, sendRequest } = host({ ok: true, result: { deleted: true } })
    const onChanged = vi.fn()
    const renderer = await render(baseProps({ client, onChanged }))
    await longPress(renderer, 'NexusCare')
    await press(renderer, 'Delete')
    expect(alert).toHaveBeenCalledWith(
      'Delete NexusCare?',
      'Its 4 tasks and their history are deleted. Files in the team folder stay.',
      expect.any(Array)
    )
    expect(sendRequest).not.toHaveBeenCalled()
    const confirm = alert.mock.calls[0][2].find(
      (button: { text: string }) => button.text === 'Delete'
    )
    await act(async () => confirm.onPress())
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.deleteProject',
      { projectId: 'p1', teamId: 't1' },
      expect.anything()
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('starts a new project from the + of the Projects heading, with no New project row', async () => {
    const onNewProject = vi.fn()
    const renderer = await render(baseProps({ onNewProject }))
    const rowTitles = renderer.root.findAll(
      (node) => node.type === 'Text' && node.children.includes('New project')
    )
    expect(rowTitles).toHaveLength(0)
    await press(renderer, 'New project')
    expect(onNewProject).toHaveBeenCalled()
  })

  it('opens Edit project from the sheet and saves the teams linked', async () => {
    const { client, sendRequest } = host({
      ok: true,
      result: { project: project({ linkedTeamIds: ['t2'] }) }
    })
    const onChanged = vi.fn()
    const renderer = await render(baseProps({ client, onChanged, teams: [MARKETING, DEVELOPMENT] }))
    await longPress(renderer, 'NexusCare')
    await press(renderer, 'Edit')
    expect(text(renderer)).toContain('Edit project')
    expect(text(renderer)).toContain('Marketing, owner')
    await press(renderer, 'Add team')
    await press(renderer, 'Add Development')
    await press(renderer, 'Save')
    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.updateProject',
      {
        projectId: 'p1',
        teamId: 't1',
        name: 'NexusCare',
        goal: '',
        linkedTeamIds: ['t2']
      },
      expect.anything()
    )
    expect(onChanged).toHaveBeenCalled()
  })
})

describe('the room menu’s task counts', () => {
  it('says 1 task, not 1 tasks, for a project of this team with one task', async () => {
    const renderer = await render(baseProps({ projectTaskCount: () => 1 }))
    expect(text(renderer)).toContain('"1 task"')
    expect(text(renderer)).not.toContain('"1 tasks"')
  })

  it('says 1 task with its owner for a linked project with one task', async () => {
    const linked = project({ id: 'p9', teamId: 't2', name: 'Website', linkedTeamIds: ['t1'] })
    const renderer = await render(
      baseProps({ teams: [MARKETING, DEVELOPMENT], projects: [linked], projectTaskCount: () => 1 })
    )
    expect(text(renderer)).toContain('1 task, owner Development')
    expect(text(renderer)).not.toContain('1 tasks')
  })

  it('says 1 task on the team board with one task', async () => {
    const renderer = await render(baseProps({ taskCount: 1 }))
    expect(text(renderer)).toContain('"1 task"')
    expect(text(renderer)).not.toContain('"1 tasks"')
  })
})
