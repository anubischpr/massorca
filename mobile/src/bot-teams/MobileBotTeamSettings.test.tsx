import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamSettings } from './MobileBotTeamSettings'

const preference = vi.hoisted(() => ({ setBotCharacterAnimations: vi.fn() }))

vi.mock('react-native', () => ({
  Alert: { alert: () => {} },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Switch: 'Switch',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight' }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./mobile-bot-character-preference', () => ({
  setBotCharacterAnimations: preference.setBotCharacterAnimations,
  useBotCharacterAnimations: () => true
}))

function renderSettings() {
  const handlers = { onBack: vi.fn() }
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamSettings, handlers))
  })
  return { renderer, ...handlers }
}

function labelsOf(renderer: ReactTestRenderer, type: string): string[] {
  return renderer.root
    .findAll((node) => node.type === type)
    .map((node) => node.props.accessibilityLabel)
}

function press(renderer: ReactTestRenderer, label: string) {
  const target = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  )
  expect(target, `a pressable labelled "${label}"`).toHaveLength(1)
  act(() => target[0].props.onPress())
}

describe('MobileBotTeamSettings', () => {
  it('shows only the character animations, with no per-team access or Marketplace rows', () => {
    const { renderer } = renderSettings()
    expect(labelsOf(renderer, 'Pressable')).toEqual(['Back'])
    expect(labelsOf(renderer, 'Switch')).toEqual(['Character animations'])
  })

  it('saves the character animations switch as the preference', () => {
    const { renderer } = renderSettings()
    const animations = renderer.root.findAll(
      (node) =>
        node.type === ('Switch' as never) &&
        node.props.accessibilityLabel === 'Character animations'
    )
    expect(animations).toHaveLength(1)
    act(() => animations[0].props.onValueChange(false))
    expect(preference.setBotCharacterAnimations).toHaveBeenCalledWith(false)
  })

  it('goes back to the Bot teams home from its back bar', () => {
    const { renderer, onBack } = renderSettings()
    press(renderer, 'Back')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
