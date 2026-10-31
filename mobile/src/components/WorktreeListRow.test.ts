import {
  createElement,
  Fragment,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { WorktreeListRow, type WorktreeListRowItem } from './WorktreeListRow'

const { markRender, agentListRender, metaRender } = vi.hoisted(() => ({
  markRender: vi.fn(),
  agentListRender: vi.fn(),
  metaRender: vi.fn()
}))

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: 'Text',
  View: 'View'
}))

vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  Folder: 'Folder',
  GitBranch: 'GitBranch',
  GitPullRequest: 'GitPullRequest'
}))

vi.mock('../platform/haptics', () => ({ triggerMediumImpact: vi.fn() }))
vi.mock('./SessionStatusMark', () => ({
  SessionStatusMark: (props: unknown) => {
    markRender(props)
    return null
  }
}))
vi.mock('./WorktreeAgentList', () => ({
  WorktreeAgentList: (props: unknown) => {
    agentListRender(props)
    return null
  }
}))
vi.mock('./WorktreeMetaGlyphs', () => ({
  prStateColor: () => '#000000',
  WorktreeMetaGlyphs: () => {
    metaRender()
    return null
  }
}))

type TestItem = WorktreeListRowItem & {
  status: 'working' | 'active' | 'permission' | 'done' | 'inactive'
  lastOutputAt: number
}

let updateSibling: Dispatch<SetStateAction<number>> = () => undefined

function ListRowHarness({
  item,
  now,
  collisionChip = null,
  hostDisconnected = false
}: {
  item: TestItem
  now: number
  collisionChip?: string | null
  hostDisconnected?: boolean
}) {
  const [sibling, setSibling] = useState(0)
  updateSibling = setSibling
  const onPress = useCallback(() => undefined, [])
  const onLongPress = useCallback(() => undefined, [])
  const onToggleLineage = useCallback(() => undefined, [])

  // Sibling state changes re-render the harness without changing the row's props,
  // exercising the row's React.memo bailout.
  return createElement(
    Fragment,
    null,
    createElement(Text, null, sibling),
    createElement(WorktreeListRow, {
      item,
      isReadOnly: false,
      now,
      status: item.status,
      collisionChip,
      hostDisconnected,
      onPress,
      onLongPress,
      onToggleLineage
    })
  )
}

function agent(overrides: Partial<RuntimeWorktreeAgentRow> = {}): RuntimeWorktreeAgentRow {
  return {
    paneKey: 'agent-1',
    parentPaneKey: null,
    state: 'working',
    agentType: null,
    prompt: 'Fix the list',
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1_000,
    updatedAt: 1_000,
    ...overrides
  }
}

const baseItem: TestItem = {
  worktreeId: 'worktree-1',
  repo: 'orca',
  branch: 'feature/mobile-list',
  displayName: 'Brave otter session title that is long',
  liveTerminalCount: 1,
  preview: 'Waiting',
  unread: false,
  linkedPR: null,
  agents: [agent()],
  status: 'active',
  lastOutputAt: 1_000
}

const textNodes = (renderer: ReactTestRenderer): string[] =>
  renderer.root
    .findAllByType('Text' as never)
    .flatMap((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string')

describe('WorktreeListRow', () => {
  let renderer: ReactTestRenderer | null = null

  beforeEach(() => {
    markRender.mockClear()
    agentListRender.mockClear()
    metaRender.mockClear()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('skips an unrelated parent render but updates for live item fields and time', async () => {
    await act(async () => {
      renderer = create(createElement(ListRowHarness, { item: baseItem, now: 2_000 }))
    })
    expect(metaRender).toHaveBeenCalledTimes(1)

    await act(async () => updateSibling((value) => value + 1))
    expect(metaRender).toHaveBeenCalledTimes(1)

    let expectedRenders = 1
    const liveUpdates: TestItem[] = [
      { ...baseItem, preview: 'Running tests' },
      { ...baseItem, unread: true },
      { ...baseItem, lastOutputAt: 2_000 },
      { ...baseItem, agents: [agent({ state: 'waiting', updatedAt: 2_000 })] },
      { ...baseItem, status: 'working' }
    ]
    for (const liveUpdate of liveUpdates) {
      await act(async () =>
        renderer!.update(createElement(ListRowHarness, { item: liveUpdate, now: 2_000 }))
      )
      expect(metaRender).toHaveBeenCalledTimes(++expectedRenders)
      await act(async () =>
        renderer!.update(createElement(ListRowHarness, { item: baseItem, now: 2_000 }))
      )
      expect(metaRender).toHaveBeenCalledTimes(++expectedRenders)
    }

    await act(async () =>
      renderer!.update(createElement(ListRowHarness, { item: baseItem, now: 32_000 }))
    )
    expect(metaRender).toHaveBeenCalledTimes(++expectedRenders)
  })

  it('labels the row with the branch, never the generated display name', async () => {
    await act(async () => {
      renderer = create(createElement(ListRowHarness, { item: baseItem, now: 2_000 }))
    })
    expect(textNodes(renderer!)).toContain('feature/mobile-list')
    expect(textNodes(renderer!)).not.toContain(baseItem.displayName)
  })

  it('shows the monitoring mode on the mark of a session-less working branch', async () => {
    await act(async () => {
      renderer = create(
        createElement(ListRowHarness, {
          item: { ...baseItem, agents: undefined, status: 'working', workingMode: 'monitoring' },
          now: 2_000
        })
      )
    })

    expect(markRender).toHaveBeenLastCalledWith({ glyph: 'monitoring' })
  })

  it('names the host only through the collision chip', async () => {
    await act(async () => {
      renderer = create(
        createElement(ListRowHarness, {
          item: { ...baseItem, hostId: 'ssh:ssh-1', hostContextLabel: 'openclaw' },
          now: 2_000
        })
      )
    })
    expect(textNodes(renderer!)).not.toContain('openclaw')

    await act(async () =>
      renderer!.update(
        createElement(ListRowHarness, {
          item: { ...baseItem, hostId: 'ssh:ssh-1', hostContextLabel: 'openclaw' },
          now: 2_000,
          collisionChip: 'openclaw'
        })
      )
    )
    expect(textNodes(renderer!)).toContain('openclaw')
  })

  it('marks a disconnected host as dimmed and unconfirmed, never exited', async () => {
    await act(async () => {
      renderer = create(
        createElement(ListRowHarness, { item: baseItem, now: 2_000, hostDisconnected: true })
      )
    })

    expect(textNodes(renderer!)).toContain('Disconnected')
    expect(agentListRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ disconnected: true })
    )
  })

  it('folds the sessions of a branch and marks it with the worst folded status', async () => {
    await act(async () => {
      renderer = create(createElement(ListRowHarness, { item: baseItem, now: 2_000 }))
    })
    const toggle = renderer!.root
      .findAllByType('Pressable' as never)
      .find((node) => String(node.props.accessibilityLabel).startsWith('Hide sessions of'))
    expect(toggle).toBeDefined()
    const listRendersBefore = agentListRender.mock.calls.length

    await act(async () => toggle!.props.onPress())

    expect(agentListRender).toHaveBeenCalledTimes(listRendersBefore)
    expect(markRender).toHaveBeenLastCalledWith({ glyph: 'working' })
  })
})
