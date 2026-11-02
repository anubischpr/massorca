import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamIntegrations } from './MobileBotTeamIntegrations'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  ChevronLeft: 'ChevronLeft',
  FolderOpen: 'FolderOpen',
  Mail: 'Mail',
  Users: 'Users'
}))

function render(onBack = vi.fn()) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamIntegrations, { onBack }))
  })
  return { renderer, onBack }
}

describe('MobileBotTeamIntegrations', () => {
  it('shows the sentence and the four apps, with nothing connected yet', () => {
    const { renderer } = render()
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).toContain('Integrations')
    expect(screen).toContain(
      'Connecting an app does not let bots act on their own. Permissions still apply.'
    )
    for (const name of ['Email', 'Calendar', 'Shared drive', 'CRM']) {
      expect(screen).toContain(name)
    }
    expect(screen).toContain('Connecting apps is not available yet.')
  })

  it('leaves every Connect button disabled', () => {
    const { renderer } = render()
    const connects = renderer.root.findAll(
      (node) =>
        node.type === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Connect ')
    )
    expect(connects.map((node) => node.props.accessibilityLabel)).toEqual([
      'Connect Email',
      'Connect Calendar',
      'Connect Shared drive',
      'Connect CRM'
    ])
    for (const connect of connects) {
      expect(connect.props.disabled).toBe(true)
      expect(connect.props.accessibilityState).toEqual({ disabled: true })
    }
  })

  it("goes back when the bar's back button is pressed", () => {
    const { renderer, onBack } = render()
    const back = renderer.root.findByProps({ accessibilityLabel: 'Back' })
    act(() => back.props.onPress())
    expect(onBack).toHaveBeenCalled()
  })
})
