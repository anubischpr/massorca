import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../src/shared/rpc-contract/prototype-params'
import { MobilePrototypeListScreen } from './MobilePrototypeListScreen'
import type { MobilePrototypeSetsState } from './mobile-prototype-sets-state'
import { listedSet } from './mobile-prototype-sets.test-fixture'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client: null }) }))
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
vi.mock('./use-mobile-prototype-sets', () => ({ useMobilePrototypeSets: () => listing.state }))

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function systemRows(tree: ReactTestRenderer): ReactTestInstance[] {
  return tree.root.findAll(
    (node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Design system'
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
