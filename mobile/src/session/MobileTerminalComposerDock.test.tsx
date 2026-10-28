import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MobileTerminalComposerDock,
  type MobileTerminalComposerController
} from './MobileTerminalComposerDock'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronUp: 'ChevronUp',
  ClipboardPaste: 'ClipboardPaste',
  CornerDownLeft: 'CornerDownLeft',
  FileText: 'FileText',
  ImagePlus: 'ImagePlus',
  Keyboard: 'Keyboard',
  Mic: 'Mic',
  Monitor: 'Monitor',
  Plus: 'Plus',
  Smartphone: 'Smartphone',
  X: 'X'
}))
vi.mock('../platform/haptics', () => ({
  triggerMediumImpact: () => {}
}))
// Phone mode for the active terminal, so the width toggle reads "Phone" and offers desktop.
vi.mock('./mobile-session-route-helpers', () => ({
  isTerminalPhoneDisplayMode: () => true
}))

function createController(overrides: Partial<MobileTerminalComposerController> = {}) {
  const spies = {
    attachImage: vi.fn(),
    dismissSoftwareKeyboard: vi.fn(),
    focusLiveInput: vi.fn(),
    handleAccessoryKey: vi.fn(),
    handlePaste: vi.fn(),
    setDeleteKeyTarget: vi.fn(),
    setShowCustomKeyModal: vi.fn(),
    toggleDisplayMode: vi.fn()
  }
  const controller: MobileTerminalComposerController = {
    activeBrowserTab: null,
    activeFileTab: null,
    activeHandle: 'terminal-1',
    activeMarkdownTab: null,
    attachImage: spies.attachImage,
    bindLiveInputField: vi.fn(),
    canPaste: false,
    canSend: true,
    cancelDictation: vi.fn(),
    customKeys: [],
    dictation: { isStarting: false, isRecording: false, isProcessing: false },
    dictationMode: 'toggle',
    dismissSoftwareKeyboard: spies.dismissSoftwareKeyboard,
    focusLiveInput: spies.focusLiveInput,
    handleAccessoryKey: spies.handleAccessoryKey,
    handleDictationPressIn: vi.fn(),
    handleDictationPressOut: vi.fn(),
    handleDictationToggle: vi.fn(),
    handleLiveInputChange: vi.fn(),
    handleLiveInputKeyPress: vi.fn(),
    handlePaste: spies.handlePaste,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    isAttaching: false,
    keyboardLift: 0,
    liveInputCapture: '',
    setDeleteKeyTarget: spies.setDeleteKeyTarget,
    setShowCustomKeyModal: spies.setShowCustomKeyModal,
    showNativeChat: false,
    submitLiveInput: vi.fn(),
    terminalKeyboardFit: 'overlay',
    terminalModes: new Map(),
    terminalPanelOpen: true,
    toggleDisplayMode: spies.toggleDisplayMode,
    ...overrides
  }
  return { controller, spies }
}

let renderer: ReactTestRenderer | null = null

afterEach(() => {
  act(() => renderer?.unmount())
  renderer = null
})

function renderComposer(controller: MobileTerminalComposerController): ReactTestRenderer {
  const mounted = create(createElement('View'))
  renderer = mounted
  act(() => {
    mounted.update(createElement(MobileTerminalComposerDock, { controller }))
  })
  return mounted
}

function pressLabelled(mounted: ReactTestRenderer, label: string): void {
  const target = mounted.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  )[0]
  if (!target) {
    throw new Error(`no pressable labelled "${label}"`)
  }
  act(() => target.props.onPress())
}

function treeOf(mounted: ReactTestRenderer): string {
  return JSON.stringify(mounted.toJSON())
}

describe('MobileTerminalComposerDock (Terminal panel composer)', () => {
  it('has no Command | Live switch and no live-input status row', () => {
    const { controller } = createController()
    const tree = treeOf(renderComposer(controller))

    expect(tree).not.toContain('Switch to buffered command input')
    expect(tree).not.toContain('Switch to live terminal input')
    expect(tree).not.toContain('Type a command')
    expect(tree).not.toContain('Live input')
    expect(tree).not.toContain('Tap to show keyboard')
    expect(tree).toContain('"accessibilityLabel":"Show keyboard for terminal input"')
  })

  it('leaves the tap area empty: no label sits between Phone and the mic', () => {
    const { controller } = createController()
    const mounted = renderComposer(controller)
    const [tapArea] = mounted.root.findAll(
      (node) => node.props.accessibilityLabel === 'Show keyboard for terminal input'
    )

    expect(treeOf(mounted)).not.toContain('Tap to type')
    expect(tapArea?.findAll((node) => String(node.type) === 'Text')).toHaveLength(0)
  })

  it('draws nothing while the Terminal panel is not the body, so no Keys row sits under the notice', () => {
    const { controller } = createController({ terminalPanelOpen: false })

    expect(renderComposer(controller).toJSON()).toBeNull()
  })

  it('sends a carriage return when Enter is pressed', () => {
    const { controller, spies } = createController()
    const mounted = renderComposer(controller)

    pressLabelled(mounted, 'Enter')

    expect(spies.handleAccessoryKey).toHaveBeenCalledTimes(1)
    expect(spies.handleAccessoryKey).toHaveBeenCalledWith({ bytes: '\r' })
  })

  it('lights keys without typing anything and sends the built chord as its bytes', () => {
    const { controller, spies } = createController()
    const mounted = renderComposer(controller)

    pressLabelled(mounted, 'Use Tab')
    expect(spies.handleAccessoryKey).not.toHaveBeenCalled()

    pressLabelled(mounted, 'Clear keys')
    pressLabelled(mounted, 'Add Ctrl to the combination')
    pressLabelled(mounted, 'Use C')
    expect(treeOf(mounted)).toContain('Ctrl + C')

    pressLabelled(mounted, 'Send Ctrl + C')
    expect(spies.handleAccessoryKey).toHaveBeenCalledWith({ bytes: '\x03' })
    expect(treeOf(mounted)).toContain('Sent Ctrl + C')
  })

  it('condenses with the keyboard up: no Keys toggle, and Dismiss keyboard hides it', () => {
    const { controller, spies } = createController({ keyboardLift: 300 })
    const mounted = renderComposer(controller)

    expect(treeOf(mounted)).not.toContain('"accessibilityLabel":"Keys"')
    pressLabelled(mounted, 'Dismiss keyboard')
    expect(spies.dismissSoftwareKeyboard).toHaveBeenCalledTimes(1)
  })

  it('shows the Keys toggle and no dismiss key with the keyboard down', () => {
    const { controller } = createController()
    const tree = treeOf(renderComposer(controller))

    expect(tree).toContain('"accessibilityLabel":"Keys"')
    expect(tree).not.toContain('"accessibilityLabel":"Dismiss keyboard"')
  })

  it('toggles the active terminal between phone and desktop width', () => {
    const { controller, spies } = createController()
    const mounted = renderComposer(controller)

    pressLabelled(mounted, 'Switch to desktop mode')

    expect(spies.toggleDisplayMode).toHaveBeenCalledWith('terminal-1')
  })

  it('focuses the live capture when the composer bar is tapped', () => {
    const { controller, spies } = createController()
    const mounted = renderComposer(controller)

    pressLabelled(mounted, 'Show keyboard for terminal input')

    expect(spies.focusLiveInput).toHaveBeenCalledTimes(1)
  })

  it('attaches a photo from the + menu and offers paste only when the clipboard has content', () => {
    const { controller, spies } = createController({ canPaste: true })
    const mounted = renderComposer(controller)

    pressLabelled(mounted, 'Attach or paste')
    expect(treeOf(mounted)).toContain('Paste from clipboard')
    pressLabelled(mounted, 'Attach a photo')

    expect(spies.attachImage).toHaveBeenCalledWith('library')
    expect(treeOf(mounted)).not.toContain('"accessibilityLabel":"Attach a photo"')
  })
})
