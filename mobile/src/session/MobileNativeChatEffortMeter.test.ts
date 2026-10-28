import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { colors } from '../theme/mobile-theme'
import { MobileNativeChatEffortMeter } from './MobileNativeChatEffortMeter'

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  View: 'View'
}))

type Node = { props: { style: unknown[] } }

// Why: the mocked View keeps its style array as passed, so each bar's colour is read from its second entry.
function barColours(level: number): unknown[] {
  let renderer: ReturnType<typeof create> | undefined
  act(() => {
    renderer = create(createElement(MobileNativeChatEffortMeter, { level }))
  })
  const tree = renderer!.toJSON() as unknown as { children: Node[] }
  return tree.children.map(
    (bar) => (bar.props.style[1] as { backgroundColor: unknown }).backgroundColor
  )
}

describe('MobileNativeChatEffortMeter', () => {
  it.each([
    { level: 0, lit: 0 },
    { level: 1, lit: 1 },
    { level: 3, lit: 3 },
    { level: 5, lit: 5 }
  ])('renders five bars and lights the first $lit at level $level', ({ level, lit }) => {
    const colours = barColours(level)
    expect(colours).toHaveLength(5)
    expect(colours).toEqual(
      Array.from({ length: 5 }, (_, index) => (index < lit ? colors.textPrimary : colors.textMuted))
    )
  })
})
