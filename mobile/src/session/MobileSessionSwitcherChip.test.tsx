import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MobileSessionTab } from './mobile-session-route-types'
import type { MobileSessionSwitcherRow } from './mobile-session-switcher-rows'
import {
  MobileSessionSwitcherChip,
  mobileSessionSwitcherChipAlignment
} from './MobileSessionSwitcherChip'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ChevronDown: 'ChevronDown' }))
vi.mock('../components/AgentStateDot', () => ({ AgentStateDot: 'AgentStateDot' }))

const terminal: MobileSessionTab = {
  type: 'terminal',
  id: 'tab-term',
  title: 'npm test',
  terminal: 'term-1',
  isActive: true
}
const workingRow: MobileSessionSwitcherRow<MobileSessionTab> = {
  tab: terminal,
  isActive: true,
  status: 'working'
}

type Props = Parameters<typeof MobileSessionSwitcherChip>[0]

describe('MobileSessionSwitcherChip', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(props: Props): ReactTestRenderer {
    act(() => renderer?.unmount())
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(createElement(MobileSessionSwitcherChip, props))
    })
    return mounted
  }

  function chip(mounted: ReactTestRenderer): ReactTestInstance {
    return mounted.root.find((node) => String(node.type) === 'Pressable')
  }

  it('names the active tab and counts the chat sessions in its label, with the tab status dot', () => {
    const mounted = mount({ activeRow: workingRow, sessionCount: 3, onPress: vi.fn() })
    expect(chip(mounted).props.accessibilityLabel).toBe('Sessions, npm test, 3 sessions')
    const dots = mounted.root.findAll((node) => String(node.type) === 'AgentStateDot')
    expect(dots.map((dot) => dot.props.state)).toEqual(['working'])
  })

  it('uses the singular noun for a single session', () => {
    const mounted = mount({ activeRow: workingRow, sessionCount: 1, onPress: vi.fn() })
    expect(chip(mounted).props.accessibilityLabel).toBe('Sessions, npm test, 1 session')
  })

  it('falls back to Sessions and draws no dot when no row is active', () => {
    const mounted = mount({ activeRow: null, sessionCount: 2, onPress: vi.fn() })
    expect(chip(mounted).props.accessibilityLabel).toBe('Sessions, Sessions, 2 sessions')
    expect(mounted.root.findAll((node) => String(node.type) === 'AgentStateDot')).toHaveLength(0)
  })

  it('opens the Sessions sheet when pressed', () => {
    const onPress = vi.fn()
    const mounted = mount({ activeRow: workingRow, sessionCount: 1, onPress })
    act(() => chip(mounted).props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('mobileSessionSwitcherChipAlignment', () => {
  it('keeps the classic header chip at the start, and centres it over a chat', () => {
    expect(mobileSessionSwitcherChipAlignment(false)).toBe('flex-start')
    expect(mobileSessionSwitcherChipAlignment(true)).toBe('center')
  })
})

describe('MobileSessionSwitcherChip placement', () => {
  function alignSelfOf(centered: boolean): unknown {
    let mounted: ReactTestRenderer | undefined
    act(() => {
      mounted = create(
        createElement(MobileSessionSwitcherChip, {
          activeRow: null,
          sessionCount: 1,
          onPress: vi.fn(),
          centered
        })
      )
    })
    const pressable = mounted!.root.find((node) => String(node.type) === 'Pressable')
    const style = pressable.props.style({ pressed: false }) as Array<Record<string, unknown>>
    act(() => mounted!.unmount())
    return style.find((part) => 'alignSelf' in part)?.alignSelf
  }

  it('applies the centred alignment to its own style, and the start alignment by default', () => {
    expect(alignSelfOf(true)).toBe('center')
    expect(alignSelfOf(false)).toBe('flex-start')
  })
})
