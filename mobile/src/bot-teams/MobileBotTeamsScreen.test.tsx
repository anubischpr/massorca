import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamsScreen } from './MobileBotTeamsScreen'

const client = {
  sendRequest: vi.fn(async () => ({ ok: true, result: { teams: [] } }))
}

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
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Layers: 'Layers',
  Plus: 'Plus',
  Settings: 'Settings',
  Users: 'Users'
}))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client }) }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))

function press(renderer: ReactTestRenderer, label: string) {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  act(() => target.props.onPress())
}

describe('MobileBotTeamsScreen', () => {
  it('keeps the typed team name after adding a bot', async () => {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamsScreen, { hostId: 'host', onShowWorkspaces: () => {} })
      )
    })
    press(renderer, 'New team')
    const nameInput = () => renderer.root.findByProps({ accessibilityLabel: 'Team name' })
    act(() => nameInput().props.onChangeText('Marketing'))

    press(renderer, 'Add a bot')
    act(() => renderer.root.findByProps({ accessibilityLabel: 'Name' }).props.onChangeText('Iris'))
    press(renderer, 'Add bot')

    expect(nameInput().props.value).toBe('Marketing')
  })
})
