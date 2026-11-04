import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import { MobilePrototypeListScreen } from './MobilePrototypeListScreen'
import type { MobilePrototypeSetsState } from './mobile-prototype-sets-state'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const hoisted = vi.hoisted(() => ({
  alert: vi.fn(),
  client: { sendRequest: vi.fn() },
  archive: vi.fn(),
  unarchive: vi.fn(),
  remove: vi.fn(),
  reload: vi.fn()
}))

vi.mock('react-native', () => ({
  Alert: { alert: hoisted.alert },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('lucide-react-native', () => ({
  Archive: 'Archive',
  ArchiveRestore: 'ArchiveRestore',
  ChevronLeft: 'ChevronLeft',
  MoreHorizontal: 'MoreHorizontal'
}))
vi.mock('../components/ActionSheetModal', () => ({ ActionSheetModal: 'ActionSheetModal' }))
vi.mock('../session/mobile-prototype-host-rpc', () => ({
  archiveMobilePrototypeRequest: hoisted.archive,
  unarchiveMobilePrototypeRequest: hoisted.unarchive,
  deleteMobilePrototypeRequest: hoisted.remove,
  hostMayArchivePrototypes: () => true
}))
vi.mock('../transport/host-client-hooks', () => ({
  useHostClient: () => ({ client: hoisted.client })
}))
vi.mock('../hooks/use-now', () => ({ useNow: () => Date.parse('2026-10-28T20:20:00.000Z') }))
vi.mock('./MobilePrototypeTile', () => ({ MobilePrototypeTile: 'MobilePrototypeTile' }))

const NEXUS: PrototypeListedDesignSystem = {
  projectKey: '/work/nexuscare',
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 24,
  swatches: ['#1d4ed8', '#e5e5e5', '#737373', '#16a34a']
}
const LANDING: PrototypeListedDesignSystem = {
  projectKey: '/work/landing-site',
  projectName: 'landing-site',
  status: 'proposed',
  version: 1,
  tokenCount: 12,
  swatches: []
}

const listing = vi.hoisted((): { state: MobilePrototypeSetsState } => ({
  state: { status: 'loading', sets: [], designSystems: [] }
}))
vi.mock('./use-mobile-prototype-sets', () => ({
  useMobilePrototypeSets: () => ({ ...listing.state, reload: hoisted.reload })
}))

/** A host element by its type name; the mocked native components are host strings. */
function isHost(node: ReactTestInstance, type: string): boolean {
  return node.type === type
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function systemRows(tree: ReactTestRenderer): ReactTestInstance[] {
  return tree.root.findAll(
    (node) => isHost(node, 'Pressable') && node.props.accessibilityLabel === 'Design system'
  )
}

function mount(onOpenSystem = vi.fn()): {
  tree: ReactTestRenderer
  onOpenSystem: typeof onOpenSystem
} {
  listing.state = {
    status: 'ready',
    sets: [
      listedSet({
        requestId: 'req-1',
        projectKey: NEXUS.projectKey,
        projectName: 'nexuscare',
        chatTitle: 'Liquidaciones fases 1-3',
        directions: listedSet().directions.slice(0, 2),
        count: 2,
        builtOn: 2
      })
    ],
    designSystems: [NEXUS, LANDING]
  }
  let tree: ReactTestRenderer | undefined
  act(() => {
    tree = create(
      createElement(MobilePrototypeListScreen, {
        hostId: 'host-1',
        sessionId: null,
        onBack: vi.fn(),
        onOpenSet: vi.fn(),
        onOpenSystem
      })
    )
  })
  if (tree === undefined) {
    throw new Error('the list did not render')
  }
  return { tree, onOpenSystem }
}

describe('MobilePrototypeListScreen design systems', () => {
  it('groups by project: the project label, its Design system row, then its sets with the built-on suffix', () => {
    const { tree } = mount()
    const all = textOf(tree.root)
    expect(all).toContain('2 directions · iterating A · built on v2')
    expect(all.indexOf('nexuscare')).toBeLessThan(all.indexOf('Detected · v2 · 24 tokens'))
    expect(all.indexOf('Detected · v2 · 24 tokens')).toBeLessThan(
      all.indexOf('Liquidaciones fases 1-3')
    )
    expect(all).toContain('landing-site')
  })

  it('shows a proposed system as needing review, without the swatch icon', () => {
    const { tree } = mount()
    const [detected, proposed] = systemRows(tree)
    expect(systemRows(tree)).toHaveLength(2)
    expect(proposed && textOf(proposed)).toContain('Proposed · needs review')
    const icons = (row: ReactTestInstance | undefined): number | undefined =>
      row?.findAll((node) => node.props.accessibilityElementsHidden === true).length
    expect(icons(detected)).toBe(1)
    expect(icons(proposed)).toBe(0)
  })

  it('opens the screen of the project when its Design system row is tapped', () => {
    const { tree, onOpenSystem } = mount()
    const [detected] = systemRows(tree)
    act(() => detected?.props.onPress())
    expect(onOpenSystem).toHaveBeenCalledWith('/work/nexuscare')
  })
})

function mountSets(sets: PrototypeListedSet[]): ReactTestRenderer {
  listing.state = { status: 'ready', sets, designSystems: [] }
  let tree: ReactTestRenderer | undefined
  act(() => {
    tree = create(
      createElement(MobilePrototypeListScreen, {
        hostId: 'host-1',
        sessionId: null,
        onBack: vi.fn(),
        onOpenSet: vi.fn(),
        onOpenSystem: vi.fn()
      })
    )
  })
  if (tree === undefined) {
    throw new Error('the list did not render')
  }
  return tree
}

type SheetAction = {
  label: string
  destructive?: boolean
  closeBeforePress?: boolean
  onPress: () => void
}

function pressByLabel(tree: ReactTestRenderer, label: string): void {
  const [button] = tree.root.findAll(
    (node) => isHost(node, 'Pressable') && node.props.accessibilityLabel === label
  )
  if (button === undefined) {
    throw new Error(`no button labelled ${label}`)
  }
  act(() => button.props.onPress())
}

function sheet(tree: ReactTestRenderer): { visible: boolean; actions: SheetAction[] } {
  const { visible, actions } = tree.root.find((node) => isHost(node, 'ActionSheetModal')).props
  return { visible, actions }
}

const ARCHIVED = listedSet({
  requestId: 'req-archived',
  chatTitle: 'Old pricing',
  archived: true,
  deletable: true
})
const KEPT = listedSet({ requestId: 'req-kept', chatTitle: 'Checkout flow' })

describe('MobilePrototypeListScreen archived sets', () => {
  beforeEach(() => {
    hoisted.alert.mockReset()
    hoisted.archive.mockReset().mockResolvedValue({ kind: 'done' })
    hoisted.unarchive.mockReset().mockResolvedValue({ kind: 'done' })
    hoisted.remove.mockReset().mockResolvedValue({ kind: 'done' })
    hoisted.reload.mockReset()
  })

  it('shows no Archived group while nothing is archived', () => {
    const tree = mountSets([KEPT])
    expect(textOf(tree.root)).not.toContain('Archived')
  })

  it('keeps archived sets out of the list and shows them under a collapsed group with a count', () => {
    const tree = mountSets([KEPT, ARCHIVED])
    expect(textOf(tree.root)).toContain('Checkout flow')
    expect(textOf(tree.root)).not.toContain('Old pricing')
    expect(textOf(tree.root)).toContain('Archived \u00b7 1')
    expect(textOf(tree.root).indexOf('Checkout flow')).toBeLessThan(
      textOf(tree.root).indexOf('Archived')
    )

    pressByLabel(tree, 'Archived')
    expect(textOf(tree.root)).toContain('Old pricing')
  })

  it('opens an archived set like any other', () => {
    listing.state = { status: 'ready', sets: [ARCHIVED], designSystems: [] }
    const onOpenSet = vi.fn()
    let tree: ReactTestRenderer | undefined
    act(() => {
      tree = create(
        createElement(MobilePrototypeListScreen, {
          hostId: 'host-1',
          sessionId: null,
          onBack: vi.fn(),
          onOpenSet,
          onOpenSystem: vi.fn()
        })
      )
    })
    if (tree === undefined) {
      throw new Error('the list did not render')
    }
    pressByLabel(tree, 'Archived')
    pressByLabel(tree, 'Old pricing')
    expect(onOpenSet).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ requestId: 'req-archived' }) })
    )
  })

  it('archives a set from its row sheet, then lists again', async () => {
    const tree = mountSets([KEPT])
    pressByLabel(tree, 'Actions for Checkout flow')
    expect(sheet(tree).visible).toBe(true)
    expect(sheet(tree).actions.map((action) => action.label)).toEqual(['Archive'])

    await act(async () => sheet(tree).actions[0]?.onPress())

    expect(hoisted.archive).toHaveBeenCalledWith(hoisted.client, {
      sessionId: 'session-alpha-0001',
      requestId: 'req-kept'
    })
    expect(hoisted.reload).toHaveBeenCalled()
  })

  it('offers Delete next to Archive on a set whose chat is gone, without archiving it first', () => {
    const tree = mountSets([
      listedSet({ requestId: 'req-orphan', chatTitle: 'Orphan', deletable: true })
    ])
    pressByLabel(tree, 'Actions for Orphan')
    expect(sheet(tree).actions.map((action) => action.label)).toEqual(['Archive', 'Delete'])
  })

  it('offers Unarchive on an archived set, and Delete only when the host lists it as deletable', async () => {
    const tree = mountSets([
      ARCHIVED,
      listedSet({ requestId: 'req-live', chatTitle: 'Live', archived: true })
    ])
    pressByLabel(tree, 'Archived')

    pressByLabel(tree, 'Actions for Old pricing')
    expect(sheet(tree).actions.map((action) => action.label)).toEqual(['Unarchive', 'Delete'])
    await act(async () => sheet(tree).actions[0]?.onPress())
    expect(hoisted.unarchive).toHaveBeenCalledWith(
      hoisted.client,
      expect.objectContaining({ requestId: 'req-archived' })
    )

    pressByLabel(tree, 'Actions for Live')
    expect(sheet(tree).actions.map((action) => action.label)).toEqual(['Unarchive'])
  })

  it('asks before deleting, and deletes only on confirmation', async () => {
    const tree = mountSets([ARCHIVED])
    pressByLabel(tree, 'Archived')
    pressByLabel(tree, 'Actions for Old pricing')
    const remove = sheet(tree).actions.find((action) => action.label === 'Delete')
    expect(remove).toMatchObject({ destructive: true, closeBeforePress: true })

    act(() => remove?.onPress())
    expect(hoisted.remove).not.toHaveBeenCalled()
    const [title, message, buttons] = hoisted.alert.mock.calls[0] ?? []
    expect(title).toBe('Delete this prototype set?')
    expect(message).toContain('Old pricing')
    expect(buttons.map((button: { text: string }) => button.text)).toEqual(['Cancel', 'Delete'])

    await act(async () => buttons[1].onPress())
    expect(hoisted.remove).toHaveBeenCalledWith(hoisted.client, {
      sessionId: 'session-alpha-0001',
      requestId: 'req-archived'
    })
    expect(hoisted.reload).toHaveBeenCalled()
  })

  it('stops offering the actions once the host shows it predates them', async () => {
    hoisted.archive.mockResolvedValue({ kind: 'unsupported-host' })
    const tree = mountSets([KEPT])
    pressByLabel(tree, 'Actions for Checkout flow')
    await act(async () => sheet(tree).actions[0]?.onPress())

    const more = tree.root.findAll(
      (node) =>
        isHost(node, 'Pressable') && String(node.props.accessibilityLabel).startsWith('Actions for')
    )
    expect(more).toHaveLength(0)
  })

  it('tells the user when the computer cannot be reached', async () => {
    hoisted.archive.mockResolvedValue({ kind: 'unreachable' })
    const tree = mountSets([KEPT])
    pressByLabel(tree, 'Actions for Checkout flow')
    await act(async () => sheet(tree).actions[0]?.onPress())
    expect(hoisted.alert).toHaveBeenCalledWith('Could not reach your computer', expect.any(String))
  })
})
