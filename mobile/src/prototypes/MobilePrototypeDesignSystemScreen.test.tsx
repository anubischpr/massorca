import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { designSystemDraftGroups } from '../../../src/shared/prototype-design-system-draft'
import type { DesignSystemContent } from '../../../src/shared/prototype-design-system-content'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import { ImageLibraryPermissionError } from '../platform/media-picker-contract'
import { MobilePrototypeDesignSystemScreen } from './MobilePrototypeDesignSystemScreen'
import {
  NEXUS_PROJECT_KEY,
  NEXUS_SYSTEM,
  nexusContent,
  nexusSet
} from './mobile-prototype-design-system.test-fixture'
import {
  mobilePrototypeDesignSystemKey,
  useMobilePrototypeViewStore
} from './mobile-prototype-view-store'

vi.mock('react-native', () => ({
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
// The photo library and the host save are the attach flow's; the screen test scripts both.
const images = vi.hoisted(() => ({
  /** What the photo library yields for the next attach; empty is a cancelled picker. */
  pick: (): AsyncIterable<{ base64: string }> => ({
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.resolve({ done: true, value: undefined })
    })
  })
}))
vi.mock('../platform/media-picker', () => ({
  useMediaPicker: () => ({
    pickImage: () => Promise.resolve(null),
    pickImages: () => images.pick()
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

const chat = vi.hoisted(() => ({
  send: vi.fn<(client: unknown, target: { sessionId: string }, text: string) => Promise<boolean>>()
}))
vi.mock('./mobile-prototype-chat-text-send', () => ({ sendMobilePrototypeText: chat.send }))

const hostSend = vi.hoisted(() => ({ send: vi.fn<(...args: unknown[]) => Promise<boolean>>() }))
vi.mock('./mobile-prototype-host-chat-send', () => ({
  sendToStructuredSessionOnHost: hostSend.send
}))

const hooks = vi.hoisted(
  (): {
    sets: PrototypeListedSet[]
    systems: PrototypeListedDesignSystem[]
    content: DesignSystemContent | null
    /** The system's files cannot be read: the hook reports an error instead of content. */
    unreadable: boolean
    /** The host client; set for the attach tests, which upload through it. */
    client: object | null
  } => ({ sets: [], systems: [], content: null, unreadable: false, client: null })
)
vi.mock('./use-mobile-prototype-sets', () => ({
  useMobilePrototypeSets: () => ({
    status: 'ready',
    sets: hooks.sets,
    designSystems: hooks.systems
  })
}))
vi.mock('./use-mobile-prototype-design-system-content', () => ({
  useMobilePrototypeDesignSystemContent: () =>
    hooks.unreadable ? { status: 'error' } : { status: 'ready', content: hooks.content }
}))

const KEY = mobilePrototypeDesignSystemKey('host-1', NEXUS_PROJECT_KEY)

/** A host element by its type name; the mocked native components are host strings. */
function isHost(node: ReactTestInstance, type: string): boolean {
  return node.type === type
}

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}

function allText(tree: ReactTestRenderer): string[] {
  return tree.root.findAll((node) => isHost(node, 'Text')).map(textOf)
}

function pressable(tree: ReactTestRenderer, name: string): ReactTestInstance {
  const [found] = tree.root.findAll(
    (node) =>
      isHost(node, 'Pressable') && (node.props.accessibilityLabel === name || textOf(node) === name)
  )
  if (found === undefined) {
    throw new Error(`no control named ${name}`)
  }
  return found
}

/** Presses a control whose handler sends, and lets the send finish. */
async function pressAndSettle(tree: ReactTestRenderer, name: string): Promise<void> {
  await act(async () => {
    pressable(tree, name).props.onPress()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function input(tree: ReactTestRenderer, label: string): ReactTestInstance {
  const [found] = tree.root.findAll(
    (node) => isHost(node, 'TextInput') && node.props.accessibilityLabel === label
  )
  if (found === undefined) {
    throw new Error(`no field labelled ${label}`)
  }
  return found
}

function press(tree: ReactTestRenderer, name: string): void {
  act(() => pressable(tree, name).props.onPress())
}

function draftItems(): string[] {
  const draft = useMobilePrototypeViewStore.getState().designSystemViews[KEY]?.draft
  const content = nexusContent()
  return draft === undefined
    ? []
    : designSystemDraftGroups({ tokens: content.tokens, components: content.components }, draft)
        .flatMap((group) => group.items)
        .map((item) => `${item.label}: ${item.text}`)
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

beforeEach(() => {
  hooks.client = null
  images.pick = () => emptyImages()
  hooks.content = nexusContent()
  hooks.sets = [nexusSet()]
  hooks.systems = [NEXUS_SYSTEM]
  hooks.unreadable = false
  chat.send.mockReset()
  chat.send.mockResolvedValue(true)
  hostSend.send.mockReset()
  hostSend.send.mockResolvedValue(true)
  useMobilePrototypeViewStore.setState({ designSystemViews: {} })
})

describe('MobilePrototypeDesignSystemScreen header and tabs', () => {
  it('names the system and its project, version and agent, over Tokens / Components / Source', () => {
    const tree = mount()
    const texts = allText(tree)
    expect(texts).toContain('Design system')
    expect(texts).toContain('nexuscare · v2 · Codex')
    const tabs = tree.root.findAll(
      (node) => isHost(node, 'Pressable') && node.props.accessibilityRole === 'tab'
    )
    expect(tabs.map(textOf)).toEqual(['Tokens', 'Components', 'Source'])
  })

  it('shows the colors as tiles and the type, space and radius summary on Tokens', () => {
    const tree = mount()
    press(tree, 'Tokens')
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Color',
        'primary',
        '#2563eb',
        'Type · Space · Radius',
        'type.display 32/600 · title 20/600 · body 14/400',
        'space 4 · 8 · 12',
        'radius sm 6 · md 10'
      ])
    )
    expect(texts).not.toContain('+ Add component')
  })

  it('lists the path and what was taken from it on Source', () => {
    const tree = mount()
    press(tree, 'Source')
    expect(allText(tree)).toEqual(
      expect.arrayContaining([
        'src/assets/main.css',
        ':root and .dark → 4 colors, radius base 10px',
        'docs/STYLEGUIDE.md',
        'type scale, spacing rules'
      ])
    )
  })

  it('shows Add component and the components with their variants on Components', () => {
    const tree = mount()
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining(['+ Add component', 'Button', 'primary · secondary', 'Input'])
    )
  })
})

describe('the token sheet', () => {
  it('names the token and its use, and puts a changed color in the draft', () => {
    const tree = mount()
    press(tree, 'Tokens')
    press(tree, 'color.primary')
    const texts = allText(tree)
    expect(texts).toContain('color.primary')
    expect(texts).toContain('Used by 1 components · 1 sets')
    expect(texts).toContain(
      'Changes join the draft on their own. Send can also rebuild the sets built on this version.'
    )
    act(() => input(tree, 'Hex').props.onChangeText('#1d4ed8'))
    expect(draftItems()).toEqual(['color: color.primary #2563eb → #1d4ed8'])
    expect(pressable(tree, 'Color #2563eb')).toBeDefined()
    expect(pressable(tree, 'Color #1d4ed8')).toBeDefined()
  })

  it('opens the color picker from the custom swatch and takes a shade', () => {
    const tree = mount()
    press(tree, 'Tokens')
    press(tree, 'color.primary')
    press(tree, 'Custom color')
    expect(allText(tree)).toContain('Custom color')
    act(() => pressable(tree, 'Hue 120').props.onPress())
    const shade = tree.root.findAll(
      (node) =>
        isHost(node, 'Pressable') &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('#')
    )[0]
    act(() => shade?.props.onPress())
    expect(draftItems()).toHaveLength(1)
  })

  it('drops the change when the original color is picked again', () => {
    const tree = mount()
    press(tree, 'Tokens')
    press(tree, 'color.primary')
    act(() => input(tree, 'Hex').props.onChangeText('#1d4ed8'))
    press(tree, 'Color #2563eb')
    expect(draftItems()).toEqual([])
  })
})

describe('the component sheet', () => {
  it('offers the variants and the color binding of a component and drafts each change', () => {
    const tree = mount()
    press(tree, 'Button')
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining(['Edit', 'Note', 'Variants and states', 'Background token'])
    )
    expect(texts).toContain('Remove component')
    expect(texts).toContain('Changes join the draft on their own.')
    expect(texts).not.toContain('Radius token')
    press(tree, 'hover')
    press(tree, 'color.muted')
    expect(draftItems()).toEqual([
      'variant: Button: add hover state',
      'binding: Button background: color.primary → color.muted'
    ])
  })

  it('drafts a note from the Note tab', () => {
    const tree = mount()
    press(tree, 'Button')
    press(tree, 'Note')
    expect(allText(tree)).toContain('Anything Edit can’t do, for this component')
    act(() =>
      input(tree, 'Anything Edit can’t do, for this component').props.onChangeText('Pulse on load')
    )
    expect(draftItems()).toEqual(['note: Button: Pulse on load'])
  })

  it('marks a component for removal, dims its row and takes the mark back', () => {
    const tree = mount()
    press(tree, 'Input')
    press(tree, 'Remove component')
    expect(draftItems()).toEqual(['remove: Remove component: Input'])
    expect(allText(tree)).toContain('Undo remove')
    press(tree, 'Close')
    expect(allText(tree)).toContain('marked for removal · in the draft')
    press(tree, 'Input')
    press(tree, 'Undo remove')
    expect(draftItems()).toEqual([])
  })
})

describe('the add sheet', () => {
  it('adds the chosen kind to the draft and shows it as to be added by the agent', () => {
    const tree = mount()
    press(tree, '+ Add component')
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Add a component',
        'Badge',
        'Modal',
        'Table',
        'Toast',
        'Avatar',
        'Toggle',
        'Or describe a custom one',
        'Add to draft'
      ])
    )
    press(tree, 'Toast')
    press(tree, 'Add to draft')
    expect(draftItems()).toEqual(['add: Add component: Toast'])
    expect(allText(tree)).not.toContain('Add a component')
    expect(allText(tree)).toEqual(
      expect.arrayContaining(['Toast', 'To be added by the agent · in the draft'])
    )
  })

  it('adds a typed description instead of the chosen kind', () => {
    const tree = mount()
    press(tree, '+ Add component')
    act(() =>
      input(tree, 'Or describe a custom one').props.onChangeText('Phase stepper with a status')
    )
    press(tree, 'Add to draft')
    expect(draftItems()).toEqual(['add: Add component: Phase stepper with a status'])
  })

  it('keeps the draft when the screen is left and opened again', () => {
    const first = mount()
    press(first, '+ Add component')
    press(first, 'Add to draft')
    act(() => first.unmount())
    mount()
    expect(draftItems()).toEqual(['add: Add component: Badge'])
  })
})

/** A draft with one color change and one new component: two items. */
function draftTwoChanges(tree: ReactTestRenderer): void {
  press(tree, 'Tokens')
  press(tree, 'color.primary')
  act(() => input(tree, 'Hex').props.onChangeText('#1d4ed8'))
  press(tree, 'Close')
  press(tree, 'Components')
  press(tree, '+ Add component')
  press(tree, 'Toast')
  press(tree, 'Add to draft')
}

describe('the change bar', () => {
  it('shows only when the draft holds changes, with their count and the agent', () => {
    const tree = mount()
    expect(allText(tree)).not.toContain('Review & send ›')
    draftTwoChanges(tree)
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining(['2', 'changes ready for Codex', 'Review & send ›'])
    )
  })

  it('goes away when the changes are taken back', () => {
    const tree = mount()
    press(tree, 'Tokens')
    press(tree, 'color.primary')
    act(() => input(tree, 'Hex').props.onChangeText('#1d4ed8'))
    press(tree, 'Close')
    expect(allText(tree)).toContain('Review & send ›')
    press(tree, 'color.primary')
    press(tree, 'Color #2563eb')
    press(tree, 'Close')
    expect(allText(tree)).not.toContain('Review & send ›')
  })
})

describe('the draft sheet', () => {
  it('lists the items by group, the rebuild line, Anything else and Send to the agent', () => {
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    const texts = allText(tree)
    expect(texts).toEqual(
      expect.arrayContaining([
        'Draft for Codex · 2',
        'Design system · tokens',
        'color.primary #2563eb → #1d4ed8',
        'Design system · components',
        'Add component: Toast',
        'Also rebuild the sets built on v2 (Liquidaciones fases 1-3) with the new tokens and components',
        'Anything else',
        'Send to Codex'
      ])
    )
    expect(texts).not.toContain("Couldn't send: the chat is no longer active. Your draft is kept.")
  })

  it('leaves out the rebuild line when no set is built on this version', () => {
    hooks.sets = [nexusSet({ builtOn: 1 })]
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    expect(allText(tree).some((text) => text.startsWith('Also rebuild'))).toBe(false)
  })

  it('sends one update message with the rebuild line, then clears the draft and closes', async () => {
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    act(() => input(tree, 'Anything else').props.onChangeText('Calmer tone'))
    await pressAndSettle(tree, 'Send to Codex')
    expect(chat.send).toHaveBeenCalledTimes(1)
    const [, target, text] = chat.send.mock.calls[0] ?? []
    expect(target?.sessionId).toBe('session-nexus')
    expect(text).toContain('Update the design system to v3.')
    expect(text).toContain('Design system · tokens')
    expect(text).toContain('color: color.primary #2563eb → #1d4ed8')
    expect(text).toContain('add: Add component: Toast')
    expect(text).toContain('Rebuild Liquidaciones fases 1-3 on v3.')
    expect(text).toContain('Calmer tone')
    expect(draftItems()).toEqual([])
    expect(allText(tree)).not.toContain('Review & send ›')
    expect(allText(tree)).not.toContain('Send to Codex')
  })

  it('sends without the rebuild line when the option is off', async () => {
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    act(() =>
      pressable(
        tree,
        'Also rebuild the sets built on v2 (Liquidaciones fases 1-3) with the new tokens and components'
      ).props.onPress()
    )
    await pressAndSettle(tree, 'Send to Codex')
    const text = chat.send.mock.calls[0]?.[2]
    expect(text).not.toContain('Rebuild ')
  })

  it('keeps the draft and shows the failure line when the chat does not take the message', async () => {
    chat.send.mockResolvedValue(false)
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await pressAndSettle(tree, 'Send to Codex')
    expect(allText(tree)).toContain(
      "Couldn't send: the chat is no longer active. Your draft is kept."
    )
    expect(draftItems()).toHaveLength(2)
    expect(allText(tree)).toContain('Draft for Codex · 2')
  })

  it('treats a send that throws as a refusal and keeps the draft', async () => {
    chat.send.mockRejectedValue(new Error('offline'))
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await pressAndSettle(tree, 'Send to Codex')
    expect(allText(tree)).toContain(
      "Couldn't send: the chat is no longer active. Your draft is kept."
    )
    expect(draftItems()).toHaveLength(2)
  })

  it('cannot send when the project has no chat to send to', () => {
    hooks.sets = []
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    expect(pressable(tree, 'Send to Codex').props.disabled).toBe(true)
  })

  it('sends to the chat of the pending request when the project has no set', async () => {
    hooks.sets = []
    hooks.systems = [
      {
        ...NEXUS_SYSTEM,
        pendingRequest: { requestId: 'req-pending', sessionId: 'session-pending', agent: 'claude' }
      }
    ]
    const tree = mount()
    draftTwoChanges(tree)
    expect(allText(tree)).toContain('changes ready for Claude')
    press(tree, 'Review & send')
    await pressAndSettle(tree, 'Send to Claude')
    expect(chat.send.mock.calls[0]?.[1].sessionId).toBe('session-pending')
  })
})

/** An image source that yields nothing, as a cancelled picker does. */
function emptyImages(): AsyncIterable<{ base64: string }> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.resolve({ done: true, value: undefined })
    })
  }
}

async function* oneImage(): AsyncGenerator<{ base64: string }> {
  yield { base64: 'aGk=' }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Presses Attach image and lets the attach run until it waits or finishes. */
async function attachImage(tree: ReactTestRenderer): Promise<void> {
  await act(async () => {
    pressable(tree, 'Attach image').props.onPress()
    await flush()
  })
}

describe('the attach image control', () => {
  it('attaches an image from Anything else and sends it with the draft', async () => {
    hooks.client = {}
    images.pick = oneImage
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await attachImage(tree)
    expect(allText(tree)).toContain('Image 1')
    await pressAndSettle(tree, 'Send to Codex')
    expect(hostSend.send).toHaveBeenCalledTimes(1)
    expect(hostSend.send.mock.calls[0]?.[3]).toEqual([
      { path: '/host/tmp/photo.png', previewUri: '/host/tmp/photo.png' }
    ])
    expect(allText(tree)).not.toContain('Image 1')
  })

  it('attaches an image from a note into the same draft', async () => {
    hooks.client = {}
    images.pick = oneImage
    const tree = mount()
    press(tree, 'Button')
    press(tree, 'Note')
    await attachImage(tree)
    expect(useMobilePrototypeViewStore.getState().designSystemViews[KEY]?.images).toEqual([
      expect.objectContaining({ path: '/host/tmp/photo.png' })
    ])
    press(tree, 'Review & send')
    expect(allText(tree)).toContain('Image 1')
  })

  it('keeps Send waiting while a picked image is still uploading', async () => {
    hooks.client = {}
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    images.pick = async function* twoImages() {
      yield { base64: 'aGk=' }
      await gate
      yield { base64: 'aGk=' }
    }
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await attachImage(tree)
    expect(pressable(tree, 'Send to Codex').props.disabled).toBe(true)
    await act(async () => {
      release()
      await flush()
    })
    expect(pressable(tree, 'Send to Codex').props.disabled).toBe(false)
  })

  it('leaves the draft as it was when the picker is cancelled', async () => {
    hooks.client = {}
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await attachImage(tree)
    expect(allText(tree)).not.toContain('Image 1')
    expect(pressable(tree, 'Send to Codex').props.disabled).toBe(false)
  })

  it('shows why an attach failed and keeps the draft', async () => {
    hooks.client = {}
    images.pick = () => {
      throw new ImageLibraryPermissionError()
    }
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await attachImage(tree)
    expect(allText(tree)).toContain('Photo permission denied')
    expect(draftItems()).toHaveLength(2)
  })
})

describe('MobilePrototypeDesignSystemScreen chat and unreadable system', () => {
  it('sends to the chat of the newest request when the project has no set and no pending request', async () => {
    hooks.sets = []
    hooks.systems = [
      {
        ...NEXUS_SYSTEM,
        newestRequest: { requestId: 'req-newest', sessionId: 'session-newest', agent: 'claude' }
      }
    ]
    const tree = mount()
    draftTwoChanges(tree)
    press(tree, 'Review & send')
    await pressAndSettle(tree, 'Send to Claude')
    expect(chat.send.mock.calls[0]?.[1].sessionId).toBe('session-newest')
  })

  it('shows a short message, not an empty body, when the system cannot be read', () => {
    hooks.unreadable = true
    const tree = mount()
    expect(allText(tree)).toContain("Couldn't open this design system")
  })

  it('shows no message when the project’s system is not listed yet', () => {
    hooks.systems = []
    const tree = mount()
    expect(allText(tree)).not.toContain("Couldn't open this design system")
  })
})
