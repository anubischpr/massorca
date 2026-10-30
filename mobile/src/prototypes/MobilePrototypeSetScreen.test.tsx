import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeMain, openDirection } from '../../../src/shared/prototype-set-state'
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
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client: null }) }))
vi.mock('./MobilePrototypeTile', () => ({ MobilePrototypeTile: 'MobilePrototypeTile' }))

const SET = listedSet({ requestId: 'req-1' })
vi.mock('./use-mobile-prototype-sets', () => ({
  useMobilePrototypeSets: () => ({ status: 'ready', sets: [SET] })
}))

const KEY = mobilePrototypeStateKey('host-1', 'req-1')

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function texts(root: ReactTestInstance, type: string): string[] {
  return root.findAll((node) => node.type === type).map(textOf)
}

function byLabel(root: ReactTestInstance, label: string): ReactTestInstance {
  const [found] = root.findAll(
    (node) => node.type === 'Pressable' && node.props.accessibilityLabel === label
  )
  if (found === undefined) {
    throw new Error(`no control labelled ${label}`)
  }
  return found
}

function mergeButton(root: ReactTestInstance): ReactTestInstance {
  const [found] = root.findAll(
    (node) =>
      node.type === 'Pressable' && textOf(node).startsWith('Merge') && node.props.accessibilityState
  )
  if (found === undefined) {
    throw new Error('no Merge button')
  }
  return found
}

function mount(onOpenDirection: () => void = vi.fn()): ReactTestRenderer {
  // B is the main: the strip and the cards start with it.
  useMobilePrototypeViewStore.setState({
    states: { [KEY]: makeMain(openDirection(createMobileSetState(['A', 'B', 'C']), 'B')) }
  })
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      createElement(MobilePrototypeSetScreen, {
        hostId: 'host-1',
        requestId: 'req-1',
        onBack: vi.fn(),
        onOpenDirection
      })
    )
  })
  if (renderer === undefined) {
    throw new Error('the set screen did not render')
  }
  const tree = renderer
  const [carousel] = tree.root.findAll(
    (node) => node.type === 'ScrollView' && node.props.snapToInterval !== undefined
  )
  act(() => {
    carousel?.props.onLayout({ nativeEvent: { layout: { height: 600 } } })
  })
  return tree
}

afterEach(() => {
  useMobilePrototypeViewStore.setState({ states: {} })
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
        .findAll((node) => node.type === 'Pressable' && node.props.accessibilityState !== undefined)
        .map(textOf)
    expect(items(children)).toEqual(['Aread-only', 'Cread-only'])
    expect(items(bar)).toEqual(['Bmain', 'Aread-only', 'Cread-only'])
    expect(children.props.style).toMatchObject({ borderLeftWidth: 1, paddingLeft: 10 })
  })

  it('gives every strip item a 44px minimum height', () => {
    const { root } = mount()
    const [first] = root.findAll((node) => node.type === 'Pressable' && textOf(node) === 'Bmain')
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
