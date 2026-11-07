import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileBotTeamsScreen } from './MobileBotTeamsScreen'

const native = vi.hoisted(() => {
  const sendRequest = vi.fn()
  return { alert: vi.fn(), sendRequest, client: { sendRequest } }
})

const OPS = {
  id: 'team-ops',
  name: 'Ops',
  purpose: 'Keeps releases moving',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: []
}

vi.mock('react-native', () => ({
  Alert: { alert: native.alert },
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
vi.mock('../transport/host-client-hooks', () => ({
  useHostClient: () => ({ client: native.client })
}))
vi.mock('../files/MobileFileMediaPreview', () => ({ MobileFileMediaPreview: () => null }))
vi.mock('../files/MobileFileMarkdownPreview', () => ({ MobileFileMarkdownPreview: () => null }))
vi.mock('../files/mobile-file-share', () => ({ shareMobileFile: async () => {} }))
vi.mock('../components/MobileRepoIcon', () => ({ MobileRepoIcon: 'MobileRepoIcon' }))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('../marketplace/marketplace-glyphs', () => ({ MarketplaceGlyph: () => null }))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Calendar: 'Calendar',
  FolderOpen: 'FolderOpen',
  Layers: 'Layers',
  Mail: 'Mail',
  Pencil: 'Pencil',
  Plug: 'Plug',
  Plus: 'Plus',
  Settings: 'Settings',
  SlidersHorizontal: 'SlidersHorizontal',
  Sparkles: 'Sparkles',
  Trash2: 'Trash2',
  Users: 'Users'
}))
vi.mock('./MobileBotTeamRoom', () => ({ MobileBotTeamRoom: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./mobile-bot-character-preference', () => ({
  setBotCharacterAnimations: () => {},
  useBotCharacterAnimations: () => true
}))
vi.mock('./use-mobile-bot-team-status', () => ({
  useMobileBotTeamStatus: () => () => 'Nothing running'
}))
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

/** Presses the element labelled `label`, or the element whose text is `label`. */
function press(renderer: ReactTestRenderer, label: string) {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )
  expect(target.length, `a pressable "${label}"`).toBeGreaterThan(0)
  act(() => target[0].props.onPress())
}

function longPress(renderer: ReactTestRenderer, label: string) {
  const target = renderer.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label && typeof node.props.onLongPress === 'function'
  )
  expect(target, `a team "${label}" with a long press`).toHaveLength(1)
  act(() => target[0].props.onLongPress())
}

function answer(method: string, params: unknown) {
  if (method === 'botTeams.list') {
    return { id: 'list', ok: true, result: { teams: [OPS] } }
  }
  if (method === 'botTeams.update') {
    return { id: 'update', ok: true, result: { team: { ...OPS, ...(params as object) } } }
  }
  if (method === 'botTeams.delete') {
    return { id: 'delete', ok: true, result: { deleted: true } }
  }
  return { id: 'other', ok: false, error: { code: 'method_not_found', message: 'Unknown method' } }
}

async function renderHome() {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamsScreen, {
        hostId: 'host',
        onShowWorkspaces: () => {},
        onOpenMarketplace: () => {},
        onOpenTask: () => {}
      })
    )
  })
  await flush()
  return renderer
}

beforeEach(() => {
  native.alert.mockReset()
  native.sendRequest.mockReset()
  native.sendRequest.mockImplementation(async (method: string, params: unknown) =>
    answer(method, params)
  )
})

describe('MobileBotTeamsScreen team edit', () => {
  it('a long press on a team character opens a sheet with Edit team and Delete team', async () => {
    const renderer = await renderHome()
    longPress(renderer, 'Ops')
    const pressables = labelsOf(renderer, 'Pressable')
    expect(pressables).toContain('Edit team')
    expect(pressables).toContain('Delete team…')
  })

  it('Edit team shows Access with no Marketplace apps, and saves the chosen access mode', async () => {
    const renderer = await renderHome()
    longPress(renderer, 'Ops')
    press(renderer, 'Edit team')
    await flush()
    expect(labelsOf(renderer, 'TextInput')).toEqual(['Name', 'Purpose'])
    expect(labelsOf(renderer, 'Pressable')).not.toContain('Marketplace apps')
    press(renderer, 'Ask first')
    press(renderer, 'Save')
    await flush()
    expect(native.sendRequest).toHaveBeenCalledWith(
      'botTeams.update',
      expect.objectContaining({ teamId: 'team-ops', accessMode: 'default' }),
      expect.anything()
    )
  })

  it('Delete team asks to confirm before it deletes the team', async () => {
    const renderer = await renderHome()
    longPress(renderer, 'Ops')
    press(renderer, 'Delete team…')
    expect(native.sendRequest).not.toHaveBeenCalledWith(
      'botTeams.delete',
      expect.anything(),
      expect.anything()
    )
    expect(native.alert).toHaveBeenCalledTimes(1)
    const [title, , buttons] = native.alert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => void }[]
    ]
    expect(title).toBe('Delete Ops?')
    const confirm = buttons.find((button) => button.style === 'destructive')
    expect(confirm?.text).toBe('Delete')
    confirm?.onPress?.()
    await flush()
    expect(native.sendRequest).toHaveBeenCalledWith(
      'botTeams.delete',
      { teamId: 'team-ops' },
      expect.anything()
    )
  })
})
