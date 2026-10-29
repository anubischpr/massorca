import { createElement, type ReactNode } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { CreateSessionChoiceSheet, type CreateSessionSheetRow } from './CreateSessionChoiceSheet'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ Check: 'Check', ChevronRight: 'ChevronRight' }))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ children }: { children: ReactNode }) => children
}))
vi.mock('../components/MobileSearchField', () => ({ MobileSearchField: 'MobileSearchField' }))

function mountSheet(rows: readonly CreateSessionSheetRow[]) {
  const mounted: { renderer: ReturnType<typeof create> | null } = { renderer: null }
  act(() => {
    mounted.renderer = create(
      createElement(CreateSessionChoiceSheet, {
        visible: true,
        title: 'Agent',
        rows,
        onSelect: () => {},
        onClose: () => {}
      })
    )
  })
  if (!mounted.renderer) {
    throw new Error('did not render')
  }
  return mounted.renderer.root
}

describe('CreateSessionChoiceSheet', () => {
  it('draws each row icon inside its own row', () => {
    const root = mountSheet([
      {
        value: 'claude',
        label: 'Claude',
        description: '',
        leading: createElement('Icon', { testID: 'claude-icon' })
      },
      {
        value: 'pi:gentle-shell',
        label: 'Gentle Shell',
        description: '',
        leading: createElement('Icon', { testID: 'gentle-shell-icon' })
      }
    ])
    const gentleShellRow = root.findByProps({ accessibilityLabel: 'Gentle Shell' })
    expect(gentleShellRow.findByProps({ testID: 'gentle-shell-icon' })).toBeDefined()
    expect(gentleShellRow.findAllByProps({ testID: 'claude-icon' })).toHaveLength(0)
    expect(root.findAllByProps({ testID: 'claude-icon' })).toHaveLength(1)
  })

  it('leaves out the icon slot for a row that has no icon', () => {
    const root = mountSheet([{ value: 'web', label: 'web', description: '' }])
    expect(root.findAllByProps({ testID: 'claude-icon' })).toHaveLength(0)
    expect(root.findByProps({ accessibilityLabel: 'web' }).findAllByType('View')).toHaveLength(1)
  })
})
