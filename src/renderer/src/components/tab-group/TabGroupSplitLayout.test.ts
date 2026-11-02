import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setTabGroupSplitRatioMock = vi.fn()
const recordFeatureInteractionMock = vi.fn()
const setDragRootNodeMock = vi.fn()
const useAppStoreMock = vi.fn(
  (
    selector: (state: {
      recordFeatureInteraction: typeof recordFeatureInteractionMock
      setTabGroupSplitRatio: typeof setTabGroupSplitRatioMock
    }) => unknown
  ) =>
    selector({
      recordFeatureInteraction: recordFeatureInteractionMock,
      setTabGroupSplitRatio: setTabGroupSplitRatioMock
    })
)
vi.mock('../../store', () => ({
  useAppStore: (
    selector: (state: {
      recordFeatureInteraction: typeof recordFeatureInteractionMock
      setTabGroupSplitRatio: typeof setTabGroupSplitRatioMock
    }) => unknown
  ) => useAppStoreMock(selector)
}))

vi.mock('./MainSessionEmptyState', () => ({
  MainSessionEmptyState: (props: unknown) => ({ __mock: 'MainSessionEmptyState', props })
}))

vi.mock('../side-panel/SidePanel', () => ({
  SidePanel: (props: unknown) => ({ __mock: 'SidePanel', props })
}))

vi.mock('./TabGroupPanel', () => ({
  default: (props: unknown) => ({ __mock: 'TabGroupPanel', props })
}))

vi.mock('./useTabDragSplit', () => ({
  useTabDragSplit: () => ({
    activeDrag: null,
    collisionDetection: vi.fn(),
    hoveredDropTarget: null,
    hoveredTabInsertion: null,
    isTabDragActiveRef: { current: false },
    onDragCancel: vi.fn(),
    onDragEnd: vi.fn(),
    onDragMove: vi.fn(),
    onDragOver: vi.fn(),
    onDragStart: vi.fn(),
    sensors: [],
    setDragRootNode: setDragRootNodeMock
  })
}))

import TabGroupSplitLayout from './TabGroupSplitLayout'

type ReactElementLike = {
  type: string | ((props: Record<string, unknown>) => unknown)
  props: Record<string, unknown>
}

function asElement(node: unknown): ReactElementLike {
  return node as ReactElementLike
}

function invokeComponent(element: ReactElementLike): unknown {
  if (typeof element.type === 'function') {
    return element.type(element.props)
  }
  return element
}

describe('TabGroupSplitLayout', () => {
  beforeEach(() => {
    setTabGroupSplitRatioMock.mockClear()
    recordFeatureInteractionMock.mockClear()
    setDragRootNodeMock.mockClear()
    useAppStoreMock.mockClear()
  })

  function getLayoutWrapper(element: ReturnType<typeof TabGroupSplitLayout>) {
    // The layout composes WorkspaceTabDragLayer (a render prop) around the chrome wrapper:
    // invoke it to reach TabDragProvider > DndContext > [wrapper, DragOverlay, split overlay].
    const providerElement = asElement(invokeComponent(asElement(element)))
    const dndContext = asElement(providerElement.props.children)
    return React.Children.toArray(dndContext.props.children as React.ReactNode)[0]
  }

  function getSplitNodeElement(element: ReturnType<typeof TabGroupSplitLayout>) {
    const layoutWrapperChildren = React.Children.toArray(
      asElement(getLayoutWrapper(element)).props.children as React.ReactNode
    )
    const splitBody = layoutWrapperChildren[0]
    // Why: the main area hosts the tree first, then its empty-state entry.
    const treeElement = React.Children.toArray(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the wrapper's split body renders the tree element first; props are untyped in this shallow-walk rig.
      asElement(splitBody).props.children as React.ReactNode
    )[0]
    // TabGroupSplitNodeTree renders the recursive SplitNode; invoke both to reach the leaf/split.
    const splitNodeElement = invokeComponent(asElement(treeElement))
    return invokeComponent(asElement(splitNodeElement))
  }

  function getLeafPanelProps(isWorktreeActive: boolean) {
    const element = TabGroupSplitLayout({
      layout: { type: 'leaf', groupId: 'group-1' },
      worktreeId: 'wt-1',
      focusedGroupId: 'group-1',
      isWorktreeActive
    })

    const tabGroupPanelElement = asElement(getSplitNodeElement(element))
    return tabGroupPanelElement.props as {
      groupId: string
      worktreeId: string
      isVisible: boolean
      isFocused: boolean
      hasSplitGroups: boolean
    }
  }

  it('does not mark an offscreen worktree group as focused', () => {
    expect(getLeafPanelProps(false)).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        worktreeId: 'wt-1',
        isVisible: false,
        isFocused: false,
        hasSplitGroups: false
      })
    )
  })

  it('keeps the visible worktree focused group active', () => {
    expect(getLeafPanelProps(true)).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        worktreeId: 'wt-1',
        isVisible: true,
        isFocused: true,
        hasSplitGroups: false
      })
    )
  })

  it('wires the split layout root to drag cleanup ownership', () => {
    const element = TabGroupSplitLayout({
      layout: { type: 'leaf', groupId: 'group-1' },
      worktreeId: 'wt-1',
      focusedGroupId: 'group-1',
      isWorktreeActive: true
    })

    expect(asElement(getLayoutWrapper(element)).props.ref).toBe(setDragRootNodeMock)
  })

  it('mounts the side panel beside the group tree for the same workspace', () => {
    const element = TabGroupSplitLayout({
      layout: { type: 'leaf', groupId: 'group-1' },
      worktreeId: 'wt-1',
      focusedGroupId: 'group-1',
      isWorktreeActive: true
    })

    const wrapperChildren = React.Children.toArray(
      asElement(getLayoutWrapper(element)).props.children as React.ReactNode
    )
    expect(wrapperChildren).toHaveLength(2)
    expect(asElement(wrapperChildren[1]).props).toEqual(
      expect.objectContaining({ worktreeId: 'wt-1', isWorktreeActive: true })
    )
  })

  it('renders no group panel for a leaf that is the side panel group', () => {
    const element = TabGroupSplitLayout({
      layout: { type: 'leaf', groupId: 'side-panel:wt-1' },
      worktreeId: 'wt-1',
      focusedGroupId: 'side-panel:wt-1',
      isWorktreeActive: true
    })

    const leaf = asElement(getSplitNodeElement(element))
    expect(leaf.type).toBe('div')
  })

  it('records pane resizing at the start of the gesture', () => {
    const element = TabGroupSplitLayout({
      layout: {
        type: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { type: 'leaf', groupId: 'left-group' },
        second: { type: 'leaf', groupId: 'right-group' }
      },
      worktreeId: 'wt-1',
      focusedGroupId: 'right-group',
      isWorktreeActive: true
    })

    const rootElement = asElement(getSplitNodeElement(element))
    const resizeHandle = asElement((rootElement.props.children as unknown[])[1])

    ;(resizeHandle.props.onResizeStart as () => void)()

    expect(recordFeatureInteractionMock).toHaveBeenCalledWith('terminal-panes')
  })
})
