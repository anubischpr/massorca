import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamsScreen } from './MobileBotTeamsScreen'

const client = { sendRequest: vi.fn() }
const TEAMS = ['t1', 't2'].map((id) => ({
  id,
  name: `Team ${id}`,
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'default' as const,
  bots: []
}))
vi.mock('./mobile-bot-team-rpc', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMobileBotTeams: async () => ({ kind: 'ready', teams: TEAMS })
}))

vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
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
vi.mock('../files/MobileFileMediaPreview', () => ({ MobileFileMediaPreview: () => null }))
vi.mock('../files/MobileFileMarkdownPreview', () => ({ MobileFileMarkdownPreview: () => null }))
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
  useMobileBotTeamStatus: () => (teamId: string) =>
    teamId === 't1' ? 'Waiting for you' : 'Nothing running'
}))

describe('the team list', () => {
  it('marks only the team with a task waiting for the person in orange', async () => {
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
    const row = (name: string) => renderer.root.findByProps({ accessibilityLabel: name })
    const marks = (name: string) =>
      row(name).findAll((node) => node.props.accessibilityLabel === 'Waiting for you')
    expect(marks('Team t1').length).toBeGreaterThan(0)
    expect(marks('Team t2')).toHaveLength(0)
  })
})
