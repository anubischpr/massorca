import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { resolveHostDisplay } from '../../../src/shared/host-display-resolution'
import { HostScreenHeader } from './host-screen-header'
import type { HostScreenController } from './use-host-screen-controller'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'Icon',
  Filter: 'Icon',
  Layers: 'Icon',
  List: 'Icon',
  PanelLeftClose: 'Icon',
  Plus: 'Icon',
  Search: 'Icon',
  SlidersHorizontal: 'Icon',
  SquareTerminal: 'Icon',
  UserCircle: 'Icon',
  Users: 'Icon',
  X: 'Icon'
}))

/** A connected, non-embedded host with a Bot teams switch, and a spy behind every control. */
function fixture(connState: string) {
  const spies = {
    leaveHost: vi.fn(),
    navigateFromHostList: vi.fn(),
    openFloatingWorkspace: vi.fn(),
    onShowTeams: vi.fn(),
    setShowSearch: vi.fn(),
    setShowFilterModal: vi.fn(),
    setShowSortPicker: vi.fn(),
    setShowGroupPicker: vi.fn()
  }
  const fields = {
    actions: {
      leaveHost: spies.leaveHost,
      navigateFromHostList: spies.navigateFromHostList,
      openFloatingWorkspace: spies.openFloatingWorkspace,
      openNewWorktreeModal: () => {}
    },
    connState,
    embedded: false,
    floatingWorkspaceEnabled: true,
    forceReconnectHost: null,
    hostId: 'host-a',
    hostDisplay: resolveHostDisplay({ name: 'Desk' }),
    lastConnectedAt: null,
    onHideSidebar: undefined,
    onShowTeams: spies.onShowTeams,
    reconnectAttempts: 0,
    relayRecovery: {
      pendingPath: null,
      pairingRejected: false,
      relayHostReachability: 'connecting'
    },
    settings: { activeFilterCount: 0, selectedSortLabel: 'Recent' },
    state: {
      hostName: 'Desk',
      groupMode: 'none',
      showSearch: false,
      setShowSearch: spies.setShowSearch,
      setShowFilterModal: spies.setShowFilterModal,
      setShowSortPicker: spies.setShowSortPicker,
      setShowGroupPicker: spies.setShowGroupPicker
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the header reads only these members on a non-embedded layout; the rest of the controller is unreachable from it.
  const controller = fields as unknown as HostScreenController
  return { controller, spies }
}

function render(connState: string): {
  tree: ReactTestRenderer
  spies: ReturnType<typeof fixture>['spies']
} {
  const { controller, spies } = fixture(connState)
  const rendered: { tree: ReactTestRenderer | null } = { tree: null }
  act(() => {
    rendered.tree = create(createElement(HostScreenHeader, { controller }))
  })
  if (rendered.tree === null) {
    throw new Error('the header did not render')
  }
  return { tree: rendered.tree, spies }
}

function controls(tree: ReactTestRenderer): ReactTestInstance[] {
  return tree.root.findAll((node) => String(node.type) === 'Pressable')
}

function control(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const found = controls(tree).find((node) => node.props.accessibilityLabel === label)
  if (!found) {
    throw new Error(`no control labelled "${label}"`)
  }
  return found
}

describe('the phone Workspaces top bar', () => {
  it('starts with the Bot teams toggle, where the Bot teams bar keeps it', () => {
    const { tree } = render('connected')

    expect(controls(tree)[0]?.props.accessibilityLabel).toBe('Bot teams')
  })

  it('keeps every control on the action it had', () => {
    const { tree, spies } = render('connected')
    const press = (label: string) => {
      act(() => {
        control(tree, label).props.onPress()
      })
    }

    press('Bot teams')
    press('Back to hosts')
    press('Accounts')
    press('Tasks')
    press('Floating Workspace')
    press('Search workspaces')
    press('Filter workspaces')
    press('Sort by Recent')
    press('Group workspaces')

    expect(spies.onShowTeams).toHaveBeenCalledTimes(1)
    expect(spies.leaveHost).toHaveBeenCalledTimes(1)
    expect(spies.navigateFromHostList.mock.calls).toEqual([
      ['/h/host-a/accounts'],
      ['/h/host-a/tasks']
    ])
    expect(spies.openFloatingWorkspace).toHaveBeenCalledTimes(1)
    expect(spies.setShowSearch).toHaveBeenCalledTimes(1)
    expect(spies.setShowFilterModal).toHaveBeenCalledWith(true)
    expect(spies.setShowSortPicker).toHaveBeenCalledWith(true)
    expect(spies.setShowGroupPicker).toHaveBeenCalledWith(true)
  })

  it('disables floating, accounts and tasks while the host is offline, as before', () => {
    const { tree } = render('reconnecting')

    for (const label of ['Floating Workspace', 'Accounts', 'Tasks']) {
      expect(control(tree, label).props.disabled).toBe(true)
    }
    expect(control(tree, 'Back to hosts').props.disabled).toBeUndefined()
  })
})
