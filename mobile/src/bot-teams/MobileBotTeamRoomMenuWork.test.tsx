import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamRoomMenu } from './MobileBotTeamRoomMenu'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
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
  Calendar: 'Calendar',
  ChevronLeft: 'ChevronLeft',
  FileText: 'FileText',
  Folder: 'Folder',
  FolderPlus: 'FolderPlus',
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

type Props = ComponentProps<typeof MobileBotTeamRoomMenu>

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

function menuProps(overrides: Partial<Props>): Props {
  return {
    visible: true,
    onClose: vi.fn(),
    team: TEAM,
    working: false,
    unreachable: false,
    openCount: null,
    taskCount: null,
    projects: [],
    projectTaskCount: () => 0,
    onOpenBoard: vi.fn(),
    onOpenRoutines: vi.fn(),
    onOpenProject: vi.fn(),
    onNewProject: vi.fn(),
    onOpenBots: vi.fn(),
    onOpenFiles: vi.fn(),
    onOpenMemory: vi.fn(),
    ...overrides
  }
}

function renderMenu(overrides: Partial<Props>) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamRoomMenu, menuProps(overrides)))
  })
  return renderer
}

/** Presses the menu row whose title is `label`. */
async function pressRow(renderer: ReactTestRenderer, label: string) {
  const row = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.children.includes(label)).length > 0
  )[0]
  await act(async () => row.props.onPress())
}

describe('the phone room menu work rows', () => {
  it('names the task board Tasks and lists Routines beside it', () => {
    const renderer = renderMenu({ taskCount: 2 })
    const text = JSON.stringify(renderer.toJSON())
    act(() => renderer.unmount())

    expect(text).toContain('"Tasks"')
    expect(text).toContain('2 tasks')
    expect(text).toContain('"Routines"')
    expect(text).not.toContain('Team board')
  })

  it('opens the tasks board and the routines from their rows', async () => {
    const onOpenBoard = vi.fn()
    const onOpenRoutines = vi.fn()
    const renderer = renderMenu({ onOpenBoard, onOpenRoutines })

    await pressRow(renderer, 'Tasks')
    expect(onOpenBoard).toHaveBeenCalledTimes(1)
    expect(onOpenRoutines).not.toHaveBeenCalled()

    await pressRow(renderer, 'Routines')
    expect(onOpenRoutines).toHaveBeenCalledTimes(1)
    act(() => renderer.unmount())
  })
})
