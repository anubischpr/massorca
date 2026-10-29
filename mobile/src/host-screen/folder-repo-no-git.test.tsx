import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { REPO_INIT_GIT_RUNTIME_CAPABILITY } from '../../../src/shared/protocol-version'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))

import { FolderRepoNoGitContent, FolderRepoNoGitPill } from './folder-repo-no-git'

type ContentFields = Partial<Parameters<typeof FolderRepoNoGitContent>[0]>

function renderContent(fields: ContentFields = {}): ReactTestRenderer {
  const props = {
    repoName: 'massorca',
    hostCapabilities: [REPO_INIT_GIT_RUNTIME_CAPABILITY],
    connected: true,
    initializing: false,
    onInitialize: () => {},
    onClose: () => {},
    ...fields
  }
  let tree: ReactTestRenderer | null = null
  act(() => {
    tree = create(createElement(FolderRepoNoGitContent, props))
  })
  if (tree === null) {
    throw new Error('the sheet did not render')
  }
  return tree
}

function textValues(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => String(node.props.children))
}

function pressableNamed(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const matches = tree.root.findAll(
    (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
  )
  if (matches.length !== 1) {
    throw new Error(`expected one "${label}" pressable, found ${matches.length}`)
  }
  return matches[0]!
}

function hasPressable(tree: ReactTestRenderer, label: string): boolean {
  return (
    tree.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
    ).length > 0
  )
}

describe('the No Git sheet content', () => {
  it('names the repo and lists what does not work', () => {
    const text = textValues(renderContent())
    expect(text).toContain('massorca has no Git')
    expect(text).toContain('Editor, terminal, and search work. Not available:')
    expect(text).toEqual(
      expect.arrayContaining([
        'Isolated workspaces and branches',
        'Child sessions in their own worktree — they would edit the same files as the parent chat',
        'Changes, diffs, and commits',
        'Pull requests and reviews',
        'Recommended only for exploring folders and non-development work.'
      ])
    )
  })

  it('offers Initialize Git with its note when the host has the capability', () => {
    const tree = renderContent()
    expect(hasPressable(tree, 'Initialize Git')).toBe(true)
    expect(textValues(tree)).toContain(
      'Initialize Git runs git init on this host and creates an empty first commit. Your files are not committed.'
    )
  })

  it('hides Initialize Git and its note on a host without the capability, keeping the rest', () => {
    const tree = renderContent({ hostCapabilities: ['something.else'] })
    expect(hasPressable(tree, 'Initialize Git')).toBe(false)
    const text = textValues(tree)
    expect(text.some((value) => value.startsWith('Initialize Git runs git init'))).toBe(false)
    expect(text).toContain('massorca has no Git')
    expect(text).toContain('Recommended only for exploring folders and non-development work.')
    expect(text).toContain('Close')
  })

  it('disables Initialize Git and shows progress while the init runs', () => {
    const tree = renderContent({ initializing: true })
    const button = pressableNamed(tree, 'Initialize Git')
    expect(button.props.disabled).toBe(true)
    expect(tree.root.findAll((node) => String(node.type) === 'ActivityIndicator')).toHaveLength(1)
  })

  it('disables Initialize Git while the host is not connected', () => {
    const tree = renderContent({ connected: false })
    expect(pressableNamed(tree, 'Initialize Git').props.disabled).toBe(true)
  })

  it('runs the init action when the button is pressed', () => {
    const onInitialize = vi.fn()
    const tree = renderContent({ onInitialize })
    act(() => {
      pressableNamed(tree, 'Initialize Git').props.onPress()
    })
    expect(onInitialize).toHaveBeenCalledTimes(1)
  })
})

describe('the No Git pill', () => {
  it('is labelled for assistive tech, has a 44pt touch area, and reports presses', () => {
    const onPress = vi.fn()
    let tree: ReactTestRenderer | null = null
    act(() => {
      tree = create(createElement(FolderRepoNoGitPill, { onPress }))
    })
    const pill = pressableNamed(tree!, 'No Git: show limitations')
    // Why: a 20pt pill plus 12pt of slop above and below is the 44pt target the artboard needs.
    expect(pill.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 8, right: 8 })
    act(() => {
      pill.props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(textValues(tree!)).toEqual(['No Git'])
  })
})
