import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { REPO_INIT_GIT_RUNTIME_CAPABILITY } from '../../../src/shared/protocol-version'

vi.mock('react-native', async () => {
  const { createElement, Fragment } = await import('react')
  type HeaderRenderer = (args: { section: { key: string } }) => ReactNode
  return {
    ActivityIndicator: 'ActivityIndicator',
    Pressable: 'Pressable',
    RefreshControl: 'RefreshControl',
    // Why: renders each section's header the way SectionList does, so the header under test shows.
    SectionList: ({
      sections,
      renderSectionHeader
    }: {
      sections: { key: string }[]
      renderSectionHeader: HeaderRenderer
    }) =>
      createElement(
        'SectionList',
        null,
        sections.map((section) =>
          createElement(Fragment, { key: section.key }, renderSectionHeader({ section }))
        )
      ),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: 'Text',
    View: 'View'
  }
})
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronRight: 'ChevronRight',
  Pin: 'Pin'
}))
vi.mock('../components/AuthFailedBanner', () => ({ AuthFailedBanner: 'AuthFailedBanner' }))
vi.mock('../components/HostDiagnosticsLink', () => ({ HostDiagnosticsLink: 'HostDiagnosticsLink' }))
vi.mock('../components/HostRouteNoticeBanner', () => ({
  HostRouteNoticeBanner: 'HostRouteNoticeBanner'
}))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
vi.mock('../components/MobileSearchField', () => ({ MobileSearchField: 'MobileSearchField' }))
vi.mock('../components/NewWorkspaceFab', () => ({
  NewWorkspaceFab: 'NewWorkspaceFab',
  FAB_SIZE: 56
}))
vi.mock('../components/WorktreeListRow', () => ({ WorktreeListRow: 'WorktreeListRow' }))
vi.mock('../worktree/host-workspace-list-states', () => ({
  HostWorkspaceListStates: 'HostWorkspaceListStates'
}))
// Why: the real drawer loads gesture and reanimated code this node test cannot parse; the stand-in
// shows its children only while visible, as the real drawer does.
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))

import { HostWorkspaceList } from './host-workspace-list'

type Harness = {
  tree: ReactTestRenderer
  toggleCollapsed: ReturnType<typeof vi.fn>
  setActionError: ReturnType<typeof vi.fn>
  fetchRepoMetadata: ReturnType<typeof vi.fn>
  sendRequest: ReturnType<typeof vi.fn>
}

type Reply = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } }

function renderList(options: {
  groupMode?: 'repo' | 'status'
  hostCapabilities?: string[]
  reply?: () => Promise<Reply>
}): Harness {
  const toggleCollapsed = vi.fn()
  const setActionError = vi.fn()
  const fetchRepoMetadata = vi.fn(async () => {})
  const sendRequest = vi.fn(async (): Promise<unknown> => {
    const reply: Reply = options.reply
      ? await options.reply()
      : { ok: true, result: { ok: true, repo: { id: 'repo-1' } } }
    return reply.ok
      ? { id: '1', ok: true, result: reply.result }
      : { id: '1', ok: false, error: reply.error }
  })
  const groupMode = options.groupMode ?? 'repo'
  const controller = {
    actions: { openWorktreeSession: () => {}, openNewWorktreeModal: () => {} },
    activeWorktreeScroll: { sectionListRef: { current: null }, onScrollToIndexFailed: () => {} },
    catalog: { refreshing: false, onRefresh: () => {} },
    client: { sendRequest },
    connState: 'connected',
    contentMaxWidth: 600,
    displayWorktrees: [],
    embedded: true,
    fetchRepoMetadata,
    forceReconnectHost: () => {},
    hostCapabilities: options.hostCapabilities ?? [REPO_INIT_GIT_RUNTIME_CAPABILITY],
    hostId: 'host-1',
    insets: { bottom: 0 },
    isReadOnly: false,
    isWideLayout: false,
    noticeParam: undefined,
    now: 0,
    reconnectAttempts: 0,
    relayRecovery: { pairingRejected: false },
    routeNotice: '',
    router: { push: () => {} },
    sectionsResult: {
      rawSections: [
        { key: 'repo-1', title: 'massorca', data: [] },
        { key: 'repo-2', title: 'other', data: [] }
      ],
      sections: [
        { key: 'repo-1', title: 'massorca', data: [] },
        { key: 'repo-2', title: 'other', data: [] }
      ],
      uniqueRepoColors: new Map()
    },
    setDismissedNotice: () => {},
    settings: { activeFilterCount: 0, toggleCollapsed },
    state: {
      actionError: '',
      setActionError,
      catalogError: null,
      collapsedGroups: new Set(),
      folderRepoIds: new Set(['repo-1']),
      groupMode,
      repoAccountsByName: new Map(),
      repoIconsByName: new Map(),
      repoIdsByName: new Map([
        ['massorca', 'repo-1'],
        ['other', 'repo-2']
      ]),
      search: '',
      showSearch: false,
      worktreesLoaded: true
    }
  }
  let tree: ReactTestRenderer | null = null
  act(() => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields listed above are read by the list and the sheet it renders.
    tree = create(createElement(HostWorkspaceList, { controller } as never))
  })
  if (tree === null) {
    throw new Error('the list did not render')
  }
  return { tree, toggleCollapsed, setActionError, fetchRepoMetadata, sendRequest }
}

function byLabel(tree: ReactTestRenderer, label: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label
  )
}

function textValues(tree: ReactTestRenderer): string[] {
  return textsWithin(tree.root)
}

function textsWithin(node: ReactTestInstance): string[] {
  return node
    .findAll((child) => String(child.type) === 'Text')
    .map((child) => String(child.props.children))
}

/** The Pressable that holds the given node: the repo section header for a pill. */
function enclosingPressable(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node.parent
  while (current !== null && String(current.type) !== 'Pressable') {
    current = current.parent
  }
  if (current === null) {
    throw new Error('no enclosing pressable')
  }
  return current
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('the folder marker in the host list', () => {
  it('shows the No Git pill only in the section header of a folder repo', () => {
    const { tree } = renderList({})
    const pills = byLabel(tree, 'No Git: show limitations')
    expect(pills).toHaveLength(1)
    const header = enclosingPressable(pills[0]!)
    expect(textsWithin(header)).toContain('massorca')
  })

  it('shows no pill when the list is not grouped by repo', () => {
    const { tree } = renderList({ groupMode: 'status' })
    expect(byLabel(tree, 'No Git: show limitations')).toHaveLength(0)
  })

  it('opens the sheet on press without toggling the section collapse', () => {
    const { tree, toggleCollapsed } = renderList({})
    expect(textValues(tree)).not.toContain('massorca has no Git')
    act(() => {
      byLabel(tree, 'No Git: show limitations')[0]!.props.onPress()
    })
    expect(toggleCollapsed).not.toHaveBeenCalled()
    expect(textValues(tree)).toContain('massorca has no Git')
  })

  it('still toggles the section when the header itself is pressed', () => {
    const { tree, toggleCollapsed } = renderList({})
    const header = enclosingPressable(byLabel(tree, 'No Git: show limitations')[0]!)
    act(() => {
      header.props.onPress()
    })
    expect(toggleCollapsed).toHaveBeenCalledWith('repo-1')
  })

  it('hides Initialize Git in the sheet on a host without the capability', () => {
    const { tree } = renderList({ hostCapabilities: [] })
    act(() => {
      byLabel(tree, 'No Git: show limitations')[0]!.props.onPress()
    })
    expect(byLabel(tree, 'Initialize Git')).toHaveLength(0)
    expect(textValues(tree)).toContain('massorca has no Git')
  })

  it('refreshes the repo list and closes the sheet when init succeeds', async () => {
    const { tree, fetchRepoMetadata, sendRequest, setActionError } = renderList({})
    act(() => {
      byLabel(tree, 'No Git: show limitations')[0]!.props.onPress()
    })
    act(() => {
      byLabel(tree, 'Initialize Git')[0]!.props.onPress()
    })
    await flush()
    expect(sendRequest).toHaveBeenCalledWith('repo.initGit', { repo: 'repo-1' })
    expect(fetchRepoMetadata).toHaveBeenCalledWith({ force: true })
    expect(textValues(tree)).not.toContain('massorca has no Git')
    expect(setActionError).not.toHaveBeenCalled()
  })

  it('shows git text in the list banner and closes the sheet when init is refused', async () => {
    const { tree, fetchRepoMetadata, setActionError } = renderList({
      reply: async () => ({
        ok: true,
        result: { ok: false, error: 'git_init_failed', message: 'fatal: cannot lock index' }
      })
    })
    act(() => {
      byLabel(tree, 'No Git: show limitations')[0]!.props.onPress()
    })
    act(() => {
      byLabel(tree, 'Initialize Git')[0]!.props.onPress()
    })
    await flush()
    expect(setActionError).toHaveBeenCalledWith('fatal: cannot lock index')
    expect(fetchRepoMetadata).not.toHaveBeenCalled()
    expect(textValues(tree)).not.toContain('massorca has no Git')
  })

  it('shows the thrown message in the list banner when the request fails', async () => {
    const { tree, setActionError } = renderList({
      reply: async () => ({
        ok: false,
        error: { code: 'host_unavailable', message: 'Host is offline' }
      })
    })
    act(() => {
      byLabel(tree, 'No Git: show limitations')[0]!.props.onPress()
    })
    act(() => {
      byLabel(tree, 'Initialize Git')[0]!.props.onPress()
    })
    await flush()
    expect(setActionError).toHaveBeenCalledWith('Host is offline')
  })
})
