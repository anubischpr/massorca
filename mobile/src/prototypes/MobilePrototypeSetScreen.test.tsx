import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePrototypeMergePlan } from '../../../src/shared/prototype-merge-plan'
import { beginMerge, planArrived } from '../../../src/shared/prototype-merge-state'
import {
  makeMain,
  openDirection,
  toggleStar,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import type { WorktreeAgentRows } from '../session/mobile-worktree-agent-rows'
import { MobilePrototypeSetScreen } from './MobilePrototypeSetScreen'
import {
  createMobileSetState,
  mobilePrototypeStateKey,
  useMobilePrototypeViewStore
} from './mobile-prototype-view-store'
import { listedSet } from './mobile-prototype-sets.test-fixture'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }))
vi.mock('./MobilePrototypeFrame', () => ({
  PROTOTYPE_UNREADABLE_LINE: "Couldn't open this prototype"
}))
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', Check: 'Check' }))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client: null }) }))
vi.mock('./MobilePrototypeTile', () => ({ MobilePrototypeTile: 'MobilePrototypeTile' }))

const merge = vi.hoisted(() => ({ start: vi.fn(), send: vi.fn() }))
vi.mock('./mobile-prototype-merge-flow', () => ({
  startMobilePrototypeMerge: merge.start,
  sendMobilePrototypeMerge: merge.send
}))
vi.mock('./use-mobile-prototype-merge-plan', () => ({ useMobilePrototypeMergePlan: vi.fn() }))
// The drawer's own animation is not under test: it shows its sheet's content while it has one, and
// reports a sheet that has closed through onAfterClose, as the real drawer does once it unmounts.
vi.mock('../components/keyed-bottom-drawer', async () => {
  const { useEffect, useRef } = await import('react')
  return {
    KeyedBottomDrawer: ({
      sheet,
      children,
      onAfterClose
    }: {
      sheet: string | null
      children: (sheet: string) => unknown
      onAfterClose?: (closed: string) => void
    }) => {
      const presented = useRef<string | null>(null)
      useEffect(() => {
        if (sheet === null && presented.current !== null) {
          onAfterClose?.(presented.current)
        }
        presented.current = sheet
      }, [sheet, onAfterClose])
      return sheet === null ? null : children(sheet)
    }
  }
})

const SET = listedSet({ requestId: 'req-1' })
const listing: { set: PrototypeListedSet } = { set: SET }
vi.mock('./use-mobile-prototype-sets', () => ({
  useMobilePrototypeSets: () => ({ status: 'ready', sets: [listing.set] })
}))

const hostRows = vi.hoisted((): { worktrees: WorktreeAgentRows[] } => ({ worktrees: [] }))
vi.mock('../session/use-worktree-agent-rows', () => ({
  useWorktreeAgentRows: () => ({ worktrees: hostRows.worktrees, refresh: () => undefined })
}))
const openSession = vi.hoisted(() => vi.fn())
vi.mock('../session/use-open-mobile-session', () => ({ useOpenMobileSession: () => openSession }))

const KEY = mobilePrototypeStateKey('host-1', 'req-1')

/** A host element by its type name; the mocked native components are host strings. */
function isHost(node: ReactTestInstance, type: string): boolean {
  return node.type === type
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function texts(root: ReactTestInstance, type: string): string[] {
  return root.findAll((node) => node.type === type).map(textOf)
}

function byLabel(root: ReactTestInstance, label: string): ReactTestInstance {
  const [found] = root.findAll(
    (node) => isHost(node, 'Pressable') && node.props.accessibilityLabel === label
  )
  if (found === undefined) {
    throw new Error(`no control labelled ${label}`)
  }
  return found
}

function mergeButton(root: ReactTestInstance): ReactTestInstance {
  const [found] = root.findAll(
    (node) =>
      isHost(node, 'Pressable') && textOf(node).startsWith('Merge') && node.props.accessibilityState
  )
  if (found === undefined) {
    throw new Error('no Merge button')
  }
  return found
}

/** B is the main: the strip and the cards start with it. */
function mainOnB(): PrototypeSetState {
  return makeMain(openDirection(createMobileSetState(['A', 'B', 'C']), 'B'))
}

function mount(
  onOpenDirection: () => void = vi.fn(),
  initial: PrototypeSetState = mainOnB(),
  onOpenVersion: (version: number) => void = vi.fn()
): ReactTestRenderer {
  useMobilePrototypeViewStore.setState({ states: { [KEY]: initial } })
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      createElement(MobilePrototypeSetScreen, {
        hostId: 'host-1',
        requestId: 'req-1',
        onBack: vi.fn(),
        onOpenDirection,
        onOpenVersion
      })
    )
  })
  if (renderer === undefined) {
    throw new Error('the set screen did not render')
  }
  const tree = renderer
  const [carousel] = tree.root.findAll(
    (node) => isHost(node, 'ScrollView') && node.props.snapToInterval !== undefined
  )
  act(() => {
    carousel?.props.onLayout({ nativeEvent: { layout: { height: 600 } } })
  })
  return tree
}

function reviewState(): PrototypeSetState {
  const text = JSON.stringify({
    id: 'plan-1',
    from: ['A', 'C'],
    parts: [
      {
        name: 'Heading',
        kind: 'section',
        selectors: { A: 'main > h1', C: 'main > h1' },
        from: 'A'
      },
      { name: 'Pay button', kind: 'component', selectors: { C: 'button.cta' }, from: 'C' }
    ]
  })
  const plan = parsePrototypeMergePlan(text)
  if (plan === null) {
    throw new Error('expected a valid plan')
  }
  const waiting = beginMerge(['A', 'C'].reduce(toggleStar, mainOnB()), {
    planId: 'plan-1',
    baseline: null
  })
  return planArrived(waiting, plan, text)
}

afterEach(() => {
  useMobilePrototypeViewStore.setState({ states: {} })
  listing.set = SET
  merge.start.mockReset()
  merge.send.mockReset()
})

describe('the set screen header', () => {
  it('names the set, the agent and how many directions it has', () => {
    const { root } = mount()
    expect(texts(root, 'Text')).toContain('Codex · 3 directions')
  })

  it('has Merge disabled below two stars and counting the stars once there are some', () => {
    const tree = mount()
    expect(textOf(mergeButton(tree.root))).toBe('Merge')
    expect(mergeButton(tree.root).props.disabled).toBe(true)

    act(() => byLabel(tree.root, 'Star A for merge').props.onPress())
    expect(textOf(mergeButton(tree.root))).toBe('Merge (1)')
    expect(mergeButton(tree.root).props.disabled).toBe(true)

    act(() => byLabel(tree.root, 'Star C for merge').props.onPress())
    expect(textOf(mergeButton(tree.root))).toBe('Merge (2)')
    expect(mergeButton(tree.root).props.disabled).toBe(false)
  })
})

describe('the directions strip', () => {
  it('shows the main first and the read-only directions nested to its right', () => {
    const { root } = mount()
    const [bar] = root.findAll((node) => node.props.accessibilityLabel === 'Directions in this set')
    const [children] = root.findAll(
      (node) => node.props.accessibilityLabel === 'Read-only directions'
    )
    if (bar === undefined || children === undefined) {
      throw new Error('the strip groups are not rendered')
    }
    const items = (parent: ReactTestInstance): string[] =>
      parent
        .findAll((node) => isHost(node, 'Pressable') && node.props.accessibilityState !== undefined)
        .map(textOf)
    expect(items(children)).toEqual(['Aread-only', 'Cread-only'])
    expect(items(bar)).toEqual(['Bmain', 'Aread-only', 'Cread-only'])
    expect(children.props.style).toMatchObject({ borderLeftWidth: 1, paddingLeft: 10 })
  })

  it('gives every strip item a 44px minimum height', () => {
    const { root } = mount()
    const [first] = root.findAll((node) => isHost(node, 'Pressable') && textOf(node) === 'Bmain')
    const style = [first?.props.style].flat(2)
    expect(style).toContainEqual(expect.objectContaining({ minHeight: 44 }))
  })
})

describe('the cards', () => {
  it('follow the strip order and line each one with its name and tag', () => {
    const { root } = mount()
    expect(texts(root, 'Text').filter((line) => / · (main|read-only)$/u.test(line))).toEqual([
      'B · Split summary · main',
      'A · Single column · read-only',
      'C · read-only'
    ])
  })

  it('star a direction, and flip the label while it is starred', () => {
    const tree = mount()
    const star = byLabel(tree.root, 'Star A for merge')
    expect(star.props.accessibilityState).toEqual({ selected: false })
    act(() => star.props.onPress())
    expect(byLabel(tree.root, 'Unstar A for merge').props.accessibilityState).toEqual({
      selected: true
    })
    act(() => byLabel(tree.root, 'Unstar A for merge').props.onPress())
    expect(byLabel(tree.root, 'Star A for merge').props.accessibilityState).toEqual({
      selected: false
    })
  })

  it('give the star button a 44px target', () => {
    const { root } = mount()
    expect(byLabel(root, 'Star B for merge').props.style).toMatchObject({ width: 44, height: 44 })
  })

  it('open a direction on a tap without changing the main', () => {
    const onOpenDirection = vi.fn()
    const tree = mount(onOpenDirection)

    act(() => byLabel(tree.root, 'Open direction C').props.onPress())

    expect(onOpenDirection).toHaveBeenCalledTimes(1)
    const state = useMobilePrototypeViewStore.getState().states[KEY]
    expect(state?.view).toBe('C')
    expect(state?.active).toBe('B')
  })

  it('end with the swipe hint that says a tap opens a design', () => {
    const { root } = mount()
    expect(texts(root, 'Text')).toContain('Swipe to compare · tap a design to open it')
  })
})

describe('the merge', () => {
  it('asks for the plan from the Merge button once two directions are starred', () => {
    const tree = mount()
    act(() => byLabel(tree.root, 'Star A for merge').props.onPress())
    act(() => byLabel(tree.root, 'Star C for merge').props.onPress())

    act(() => mergeButton(tree.root).props.onPress())

    expect(merge.start).toHaveBeenCalledTimes(1)
    expect(merge.start.mock.calls[0]?.[0]).toMatchObject({ set: SET, nextLetter: 'D' })
  })

  it('shows a skeleton of the sheet while the plan is awaited, with no review content', () => {
    const waiting = beginMerge(['A', 'C'].reduce(toggleStar, mainOnB()), {
      planId: 'plan-1',
      baseline: null
    })
    const { root } = mount(vi.fn(), waiting)
    expect(root.findAllByProps({ testID: 'mobile-merge-skeleton' }).length).toBeGreaterThan(0)
    expect(texts(root, 'Text').some((line) => line.startsWith('Merge A and C'))).toBe(false)
    expect(root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0)
  })

  it('shows the review as a sheet with Parts and Preview once the plan arrived, and sends from it', () => {
    const { root } = mount(vi.fn(), reviewState())
    const lines = texts(root, 'Text')
    expect(lines).toContain('Merge A and C')
    expect(root.findAllByProps({ accessibilityRole: 'tab' }).map(textOf)).toEqual([
      'Parts',
      'Preview'
    ])

    const [send] = root.findAll(
      (node) => isHost(node, 'Pressable') && textOf(node) === 'Merge into D'
    )
    act(() => send?.props.onPress())
    expect(merge.send).toHaveBeenCalledTimes(1)
  })

  it('puts the merged direction first and tagged main once the set lists it, with the stars cleared', () => {
    const sent: PrototypeSetState = {
      ...mainOnB(),
      starred: ['A', 'C'],
      mergeInto: { letter: 'D', from: ['A', 'C'] }
    }
    const tree = mount(vi.fn(), sent)
    const [a, b, c] = SET.directions
    if (a === undefined || b === undefined || c === undefined) {
      throw new Error('the fixture has three directions')
    }
    const merged = {
      letter: 'D',
      name: 'Merged from A + C',
      versions: [{ version: 1, fileName: 'prototypes/req-1/D.html', mtime: 1 }]
    }
    listing.set = { ...SET, directions: [a, b, c, merged] }
    act(() => {
      tree.update(
        createElement(MobilePrototypeSetScreen, {
          hostId: 'host-1',
          requestId: 'req-1',
          onBack: vi.fn(),
          onOpenDirection: vi.fn()
        })
      )
    })

    expect(useMobilePrototypeViewStore.getState().states[KEY]).toMatchObject({
      active: 'D',
      starred: [],
      mergedFrom: { D: ['A', 'C'] }
    })
    expect(texts(tree.root, 'Text').filter((line) => / · (main|read-only)$/u.test(line))).toEqual([
      'D · Merged from A + C · main',
      'A · Single column · read-only',
      'B · Split summary · read-only',
      'C · read-only'
    ])
    expect(mergeButton(tree.root).props.disabled).toBe(true)
  })
})

describe('the set screen names the parent chat of a delegated set', () => {
  const PARENT_PANE = `${structuredAgentSessionTabId('parent-1')}:leaf-1`

  afterEach(() => {
    listing.set = SET
    hostRows.worktrees = []
    openSession.mockReset()
  })

  it('shows the parent as a chip after the subtitle, and opens the parent chat on tap', () => {
    listing.set = { ...SET, origin: { sessionId: 'parent-1' } }
    hostRows.worktrees = [
      {
        worktreeId: 'wt-1',
        agents: [{ paneKey: PARENT_PANE, parentPaneKey: null, title: 'nexuscare-planning' }]
      }
    ]
    const tree = mount()
    expect(texts(tree.root, 'Text')).toEqual(
      expect.arrayContaining(['Codex · 3 directions', 'from “nexuscare-planning” ›'])
    )
    const [link] = tree.root.findAll(
      (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'link'
    )
    act(() => link?.props.onPress())
    expect(openSession).toHaveBeenCalledWith({
      hostId: 'host-1',
      worktreeId: 'wt-1',
      paneKey: PARENT_PANE
    })
  })

  it('shows "from parent chat" for a parent the host lists without a name, and still opens it', () => {
    listing.set = { ...SET, origin: { sessionId: 'parent-1' } }
    hostRows.worktrees = [
      { worktreeId: 'wt-1', agents: [{ paneKey: PARENT_PANE, parentPaneKey: null }] }
    ]
    const tree = mount()
    expect(texts(tree.root, 'Text')).toContain('from parent chat ›')
    const [link] = tree.root.findAll(
      (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'link'
    )
    act(() => link?.props.onPress())
    expect(openSession).toHaveBeenCalledWith({
      hostId: 'host-1',
      worktreeId: 'wt-1',
      paneKey: PARENT_PANE
    })
  })

  it('shows "from parent chat" as a chip that cannot open a parent the host does not list', () => {
    listing.set = { ...SET, origin: { sessionId: 'parent-1' } }
    hostRows.worktrees = []
    const tree = mount()
    expect(texts(tree.root, 'Text')).toContain('from parent chat')
    const [link] = tree.root.findAll(
      (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'link'
    )
    expect(link?.props.disabled).toBe(true)
    expect(openSession).not.toHaveBeenCalled()
  })

  it('shows no origin part for a set made directly in a chat', () => {
    const tree = mount()
    expect(texts(tree.root, 'Text')).toContain('Codex · 3 directions')
    expect(tree.root.findAll((node) => node.props.accessibilityRole === 'link')).toHaveLength(0)
  })
})

describe('the Versions of a direction', () => {
  /** The Versions action in a direction's ⋯ menu, once the menu is open. */
  function versionsAction(root: ReactTestInstance): ReactTestInstance {
    const [found] = root.findAll((node) => isHost(node, 'Pressable') && textOf(node) === 'Versions')
    if (found === undefined) {
      throw new Error('no Versions action in the menu')
    }
    return found
  }

  it('is one action in the ⋯ menu of its direction card', () => {
    const tree = mount()
    expect(texts(tree.root, 'Text')).not.toContain('Versions')
    act(() => byLabel(tree.root, 'More for direction B').props.onPress())
    expect(versionsAction(tree.root)).toBeDefined()
  })

  it('lists its versions newest first, and an earlier one opens that version of the direction', () => {
    const onOpenVersion = vi.fn()
    const tree = mount(vi.fn(), createMobileSetState(['A', 'B', 'C']), onOpenVersion)
    act(() => byLabel(tree.root, 'More for direction B').props.onPress())
    act(() => versionsAction(tree.root).props.onPress())

    expect(texts(tree.root, 'Text')).toContain('Versions of B')
    const rowLabels = tree.root
      .findAll(
        (node) =>
          isHost(node, 'Pressable') &&
          typeof node.props.accessibilityLabel === 'string' &&
          /^(Current · )?v\d+,/.test(node.props.accessibilityLabel)
      )
      .map((node) => node.props.accessibilityLabel)
    expect(rowLabels).toEqual([
      expect.stringMatching(/^Current · v2,/),
      expect.stringMatching(/^v1,/)
    ])

    act(() => byLabel(tree.root, rowLabels[1]).props.onPress())
    expect(onOpenVersion).toHaveBeenCalledWith(1)
    expect(useMobilePrototypeViewStore.getState().states[KEY]?.view).toBe('B')
  })
})
