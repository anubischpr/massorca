import { createElement } from 'react'
import { Alert } from 'react-native'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignSystemContent } from '../../../src/shared/prototype-design-system-content'
import type {
  DesignSystemVersionListed,
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import { MobilePrototypeDesignSystemScreen } from './MobilePrototypeDesignSystemScreen'
import {
  NEXUS_PROJECT_KEY,
  NEXUS_SYSTEM,
  nexusContent,
  nexusSet
} from './mobile-prototype-design-system.test-fixture'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  ClipPath: 'ClipPath',
  Defs: 'Defs',
  Path: 'Path',
  Rect: 'Rect'
}))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Check: 'Check',
  ImagePlus: 'ImagePlus'
}))
vi.mock('../transport/host-client-hooks', () => ({
  useHostClient: () => ({ client: hooks.client })
}))
vi.mock('../platform/media-picker', () => ({
  useMediaPicker: () => ({
    pickImage: () => Promise.resolve(null),
    pickImages: () => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ done: true, value: undefined })
      })
    })
  })
}))
vi.mock('../session/mobile-clipboard-image', () => ({
  saveMobileClipboardImageAsTempFile: () => Promise.resolve('/host/tmp/photo.png')
}))
vi.mock('../session/mobile-worktree-connection-id', () => ({
  readMobileWorktreeConnectionId: () => Promise.resolve(null)
}))
// The drawer's own animation is not under test: it shows its sheet's content while it has one.
vi.mock('../components/keyed-bottom-drawer', () => ({
  KeyedBottomDrawer: ({
    sheet,
    children
  }: {
    sheet: string | null
    children: (sheet: string) => unknown
  }) => (sheet === null ? null : children(sheet))
}))

const hooks = vi.hoisted(
  (): {
    sets: PrototypeListedSet[]
    systems: PrototypeListedDesignSystem[]
    content: DesignSystemContent | null
    /** The version the content hook was last asked to read; undefined is the current system. */
    readVersion: number | null | undefined
    versions: { status: 'ready' | 'unsupported' | 'error'; versions: DesignSystemVersionListed[] }
    reloadVersions: () => void
    reloadSets: () => void
    /** What the host answers a restore with. */
    restore: (version: number) => Promise<unknown>
    client: object | null
  } => ({
    sets: [],
    systems: [],
    content: null,
    readVersion: undefined,
    versions: { status: 'ready', versions: [] },
    reloadVersions: () => {},
    reloadSets: () => {},
    restore: () => Promise.resolve({ kind: 'unreachable' }),
    client: null
  })
)
vi.mock('./use-mobile-prototype-sets', () => ({
  useMobilePrototypeSets: () => ({
    status: 'ready',
    sets: hooks.sets,
    designSystems: hooks.systems,
    reload: hooks.reloadSets
  })
}))
vi.mock('./use-mobile-prototype-design-system-content', () => ({
  useMobilePrototypeDesignSystemContent: (
    _client: unknown,
    _sessionId: unknown,
    _reloadKey: unknown,
    version: number | null | undefined
  ) => {
    hooks.readVersion = version
    return hooks.content === null
      ? { status: 'loading' }
      : { status: 'ready', content: hooks.content }
  }
}))
vi.mock('./use-mobile-prototype-design-system-versions', () => ({
  useMobilePrototypeDesignSystemVersions: () => ({
    ...hooks.versions,
    reload: hooks.reloadVersions
  })
}))
vi.mock('./mobile-prototype-design-system-version-rpc', () => ({
  restoreMobilePrototypeDesignSystemVersion: (_client: unknown, params: { version: number }) =>
    hooks.restore(params.version)
}))

const VERSIONS: DesignSystemVersionListed[] = [
  { version: 4, at: new Date().toISOString(), saved: true, current: true },
  { version: 3, at: new Date().toISOString(), saved: true, current: false },
  { version: 2, saved: false, current: false }
]

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function allText(tree: ReactTestRenderer): string[] {
  return tree.root.findAll((node) => node.type === 'Text').map(textOf)
}

function pressables(tree: ReactTestRenderer, name: string): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.type === 'Pressable' && (node.props.accessibilityLabel === name || textOf(node) === name)
  )
}

function press(tree: ReactTestRenderer, name: string): void {
  const [found] = pressables(tree, name)
  if (found === undefined) {
    throw new Error(`no control named ${name}`)
  }
  act(() => found.props.onPress())
}

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined
  act(() => {
    tree = create(
      createElement(MobilePrototypeDesignSystemScreen, {
        hostId: 'host-1',
        projectKey: NEXUS_PROJECT_KEY,
        onBack: vi.fn()
      })
    )
  })
  if (tree === undefined) {
    throw new Error('the screen did not render')
  }
  return tree
}

/** The button of the first Alert the screen showed, pressed by its label. */
function pressAlertButton(label: string): void {
  const calls = vi.mocked(Alert.alert).mock.calls
  const buttons = calls[calls.length - 1]?.[2] ?? []
  const button = buttons.find((candidate) => candidate.text === label)
  if (button?.onPress === undefined) {
    throw new Error(`no alert button ${label}`)
  }
  button.onPress()
}

beforeEach(() => {
  hooks.client = {}
  hooks.sets = [nexusSet()]
  hooks.systems = [NEXUS_SYSTEM]
  hooks.content = nexusContent()
  hooks.readVersion = undefined
  hooks.versions = { status: 'ready', versions: VERSIONS }
  hooks.reloadVersions = () => {}
  hooks.reloadSets = () => {}
  hooks.restore = () => Promise.resolve({ kind: 'unreachable' })
  vi.mocked(Alert.alert).mockReset()
})

describe('design system Versions sheet', () => {
  it('opens the Versions sheet from the header button', () => {
    const tree = mount()
    expect(allText(tree)).not.toContain('Current · v4')
    press(tree, 'Versions')
    expect(allText(tree)).toContain('Current · v4')
  })

  it('lists the current version without a button, a saved earlier one with View, and an unsaved one as not saved', () => {
    const tree = mount()
    press(tree, 'Versions')
    const text = allText(tree)
    expect(text).toContain('Current · v4')
    expect(text).toContain('v3')
    expect(text).toContain('v2')
    expect(text).toContain('not saved')
    // Why: only the saved earlier version can be opened; the current and unsaved rows have no View.
    expect(pressables(tree, 'View')).toHaveLength(1)
  })

  it('is hidden on a host that lacks the versions method', () => {
    hooks.versions = { status: 'unsupported', versions: [] }
    const tree = mount()
    expect(pressables(tree, 'Versions')).toHaveLength(0)
  })
})

describe('design system earlier version', () => {
  it('shows the chosen version read-only, with its banner and Restore as the next version', () => {
    const tree = mount()
    press(tree, 'Versions')
    press(tree, 'View')
    expect(hooks.readVersion).toBe(3)
    expect(allText(tree)).toContain('Viewing v3 · read-only')
    expect(pressables(tree, '↺ Restore as v5')).toHaveLength(1)
    // Why: the banner offers a way back to the current system, so an earlier version never traps the view.
    expect(pressables(tree, 'Back to current')).toHaveLength(1)
  })

  it('asks first with the exact confirm text, restores through the host, then reloads', async () => {
    const restore = vi.fn((_version: number) =>
      Promise.resolve({ kind: 'restored', version: 5 } as const)
    )
    hooks.restore = restore
    const reloadVersions = vi.fn()
    const reloadSets = vi.fn()
    hooks.reloadVersions = reloadVersions
    hooks.reloadSets = reloadSets
    const tree = mount()
    press(tree, 'Versions')
    press(tree, 'View')
    press(tree, '↺ Restore as v5')
    expect(Alert.alert).toHaveBeenCalledWith(
      'Restore v3 as v5?',
      'It becomes version 5, the current one, with the content of v3. Versions 1 to 4 stay in the list.',
      expect.any(Array)
    )
    expect(restore).not.toHaveBeenCalled()
    await act(async () => {
      pressAlertButton('Restore')
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
    expect(restore).toHaveBeenCalledWith(3)
    expect(reloadSets).toHaveBeenCalled()
    expect(reloadVersions).toHaveBeenCalled()
  })

  it('shows the refusal as an alert and keeps the earlier version on screen', async () => {
    hooks.restore = () => Promise.resolve({ kind: 'refused', error: 'current' })
    const tree = mount()
    press(tree, 'Versions')
    press(tree, 'View')
    press(tree, '↺ Restore as v5')
    await act(async () => {
      pressAlertButton('Restore')
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'This is already the current version',
      'Nothing was restored.'
    )
    expect(allText(tree)).toContain('Viewing v3 · read-only')
  })
})
