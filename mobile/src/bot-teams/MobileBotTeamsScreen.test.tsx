import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamsScreen } from './MobileBotTeamsScreen'

const client = {
  sendRequest: vi.fn(async () => ({ ok: true, result: { teams: [] } }))
}

vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
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
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Layers: 'Layers',
  Calendar: 'Calendar',
  FolderOpen: 'FolderOpen',
  Mail: 'Mail',
  Plug: 'Plug',
  Plus: 'Plus',
  Settings: 'Settings',
  SlidersHorizontal: 'SlidersHorizontal',
  Sparkles: 'Sparkles',
  Users: 'Users'
}))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client }) }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamRoom', () => ({ MobileBotTeamRoom: () => null }))
// Why: expo-router does not load under vitest; the room's Prototypes links are covered on their own.
vi.mock('../prototypes/use-open-mobile-prototype-set', () => ({
  useOpenMobilePrototypeSet: () => () => {}
}))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./mobile-bot-character-preference', () => ({
  setBotCharacterAnimations: () => {},
  useBotCharacterAnimations: () => true
}))
vi.mock('./use-mobile-bot-team-status', () => ({
  useMobileBotTeamStatus: () => () => 'Nothing running'
}))

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
  it('opens the apps list from an Integrations row on the home screen', async () => {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamsScreen, {
          hostId: 'host',
          onShowWorkspaces: () => {},
          onOpenTask: () => {}
        })
      )
    })
    press(renderer, 'Integrations')
    expect(JSON.stringify(renderer.toJSON())).toContain('Connecting apps is not available yet.')
  })

  it('keeps the typed team name after adding a bot', async () => {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamsScreen, {
          hostId: 'host',
          onShowWorkspaces: () => {},
          onOpenTask: () => {}
        })
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

  it('edits a bot while creating a team, in the add form with its values', async () => {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamsScreen, {
          hostId: 'host',
          onShowWorkspaces: () => {},
          onOpenTask: () => {}
        })
      )
    })
    press(renderer, 'New team')
    press(renderer, 'Add a bot')
    act(() => renderer.root.findByProps({ accessibilityLabel: 'Name' }).props.onChangeText('Juan'))
    press(renderer, 'Add bot')

    press(renderer, 'Edit Juan')
    const name = () => renderer.root.findByProps({ accessibilityLabel: 'Name' })
    expect(name().props.value).toBe('Juan')
    act(() => name().props.onChangeText('Ana'))
    press(renderer, 'Save')

    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Edit Ana' }).length).toBeGreaterThan(
      0
    )
  })
})
