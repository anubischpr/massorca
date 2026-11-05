import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamsScreen } from './MobileBotTeamsScreen'

const ENGRAM = {
  id: 'engram',
  connected: true,
  agents: [],
  access: {
    agents: { mode: 'everyone', ids: [] },
    bots: { mode: 'everyone', botIds: [], teamIds: [] }
  }
}
const client = {
  sendRequest: vi.fn(async (method: string) =>
    method === 'marketplace.apps.list'
      ? { id: 'list', ok: true, result: { ok: true, apps: [ENGRAM] } }
      : { id: 'other', ok: false, error: { code: 'method_not_found', message: 'Unknown method' } }
  )
}
const TEAMS = [
  {
    id: 'team-ops',
    name: 'Ops',
    purpose: '',
    character: 'circle' as const,
    workspacesEnabled: false,
    accessMode: 'default' as const,
    bots: []
  },
  {
    id: 'team-design',
    name: 'Design',
    purpose: '',
    character: 'square' as const,
    workspacesEnabled: false,
    accessMode: 'default' as const,
    bots: []
  }
]

vi.mock('./mobile-bot-team-rpc', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMobileBotTeams: async () => ({ kind: 'ready', teams: TEAMS })
}))
vi.mock('../transport/host-client-hooks', () => ({ useHostClient: () => ({ client }) }))
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
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 })
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('../files/MobileFileMediaPreview', () => ({ MobileFileMediaPreview: () => null }))
vi.mock('../files/MobileFileMarkdownPreview', () => ({ MobileFileMarkdownPreview: () => null }))
// Why: expo-sharing needs the native runtime's __DEV__ global, which this node test does not provide.
vi.mock('../files/mobile-file-share', () => ({ shareMobileFile: async () => {} }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
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
vi.mock('./MobileBotTeamRoom', () => ({ MobileBotTeamRoom: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('../marketplace/marketplace-glyphs', () => ({ MarketplaceGlyph: () => null }))
vi.mock('./mobile-bot-character-preference', () => ({
  setBotCharacterAnimations: () => {},
  useBotCharacterAnimations: () => true
}))
vi.mock('./use-mobile-bot-team-status', () => ({
  useMobileBotTeamStatus: () => () => 'Nothing running'
}))
// Why: expo-router does not load under vitest; the room's Prototypes links are covered on their own.
vi.mock('../prototypes/use-open-mobile-prototype-set', () => ({
  useOpenMobilePrototypeSet: () => () => {}
}))

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
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

describe('MobileBotTeamsScreen Marketplace apps', () => {
  it('reaches a team Marketplace apps from Bot teams settings, and back out again', async () => {
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
    await flush()

    press(renderer, 'Bot teams settings')
    press(renderer, 'Ops Marketplace apps')
    await flush()
    expect(labelsOf(renderer, 'Switch')).toEqual(['Let Ops use Engram'])

    press(renderer, 'Back')
    expect(labelsOf(renderer, 'Pressable')).toContain('Ops Marketplace apps')

    press(renderer, 'Back')
    expect(labelsOf(renderer, 'Pressable')).toContain('Bot teams settings')
  })
})
