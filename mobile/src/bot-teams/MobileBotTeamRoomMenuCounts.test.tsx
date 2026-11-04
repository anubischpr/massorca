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

/** The menu's rendered text, so a row's meta line is either there or not. */
function renderedMenu(overrides: Partial<Props>): string {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamRoomMenu, menuProps(overrides)))
  })
  const text = JSON.stringify(renderer.toJSON())
  act(() => renderer.unmount())
  return text
}

describe('the phone room menu counts', () => {
  it('shows no conversation or task count before the room has loaded', () => {
    const text = renderedMenu({ openCount: null, taskCount: null })

    expect(text).toContain('Conference room')
    expect(text).not.toContain('Nothing open')
    expect(text).not.toContain('No tasks')
    expect(text).not.toMatch(/null (open|tasks)|undefined (open|tasks)/)
  })

  it('says nothing is open and there are no tasks once the room has loaded empty', () => {
    const text = renderedMenu({ openCount: 0, taskCount: 0 })

    expect(text).toContain('Nothing open')
    expect(text).toContain('No tasks')
  })

  it('counts the open conversation and the tasks once the room has loaded', () => {
    const text = renderedMenu({ openCount: 2, taskCount: 3 })

    expect(text).toContain('2 open')
    expect(text).toContain('3 tasks')
  })
})
