import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeListedDesignSystem } from '../../../src/shared/rpc-contract/prototype-params'
import { MobilePrototypeSystemRow } from './MobilePrototypeSystemRow'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))

const DETECTED: PrototypeListedDesignSystem = {
  projectKey: 'nexuscare',
  projectName: 'NexusCare',
  folderPath: '/home/ada/NexusCare/design/system',
  status: 'detected',
  version: 1,
  tokenCount: 24,
  swatches: ['#111111', '#ffffff', '#888888', '#22aa55'],
  componentCount: 0
}

type Style = Record<string, unknown>

function flat(style: unknown): Style {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((entry) => flat(entry)))
  }
  return typeof style === 'object' && style !== null ? { ...style } : {}
}

describe('MobilePrototypeSystemRow swatch icon', () => {
  let renderer: ReactTestRenderer | null = null
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(system: PrototypeListedDesignSystem): ReactTestRenderer {
    act(() => {
      renderer = create(
        createElement(MobilePrototypeSystemRow, { system, onPress: () => undefined })
      )
    })
    return renderer!
  }

  it('lays the four swatches in two rows of two, not one column', () => {
    const tree = mount(DETECTED)
    const icon = tree.root.find((node) => node.props.importantForAccessibility === 'no')
    const rows = icon.children.filter((child) => typeof child !== 'string')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(typeof row === 'string' ? 0 : row.children).toHaveLength(2)
    }
  })

  it('fits the two rows inside the icon box, so nothing spills over the row below', () => {
    const tree = mount(DETECTED)
    const icon = flat(
      tree.root.find((node) => node.props.importantForAccessibility === 'no').props.style
    )
    const cell = flat(
      tree.root.findAll((node) => flat(node.props.style).borderRadius === 3)[0]?.props.style
    )
    const gap = Number(icon.gap)
    const innerWidth = Number(icon.width) - 2 * Number(icon.paddingHorizontal) - 2 * 1
    const innerHeight = Number(icon.height) - 2
    expect(2 * Number(cell.width) + gap).toBeLessThanOrEqual(innerWidth)
    expect(2 * Number(cell.height) + gap).toBeLessThanOrEqual(innerHeight)
    expect(icon.overflow).toBe('hidden')
  })

  it('draws no icon for a system that was proposed, not detected', () => {
    const tree = mount({ ...DETECTED, status: 'proposed' })
    expect(tree.root.findAll((node) => node.props.importantForAccessibility === 'no')).toHaveLength(
      0
    )
  })
})
