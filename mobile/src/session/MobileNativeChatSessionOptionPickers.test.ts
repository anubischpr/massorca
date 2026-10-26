import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import { colors } from '../theme/mobile-theme'
import { MobileNativeChatSessionOptionPickers } from './MobileNativeChatSessionOptionPickers'
import type { MobileNativeChatSessionOptionsController } from './use-mobile-native-chat-session-options'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Keyboard: { dismiss: vi.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Switch: 'Switch',
  Text: 'Text',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Eye: 'Eye',
  Lock: 'Lock',
  LockKeyhole: 'LockKeyhole',
  LockOpen: 'LockOpen',
  NotebookPen: 'NotebookPen',
  X: 'X',
  Zap: 'Zap'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: 'MobileAgentIcon' }))
vi.mock('../components/BottomDrawer', async () => {
  const React = await import('react')
  return {
    BottomDrawer: ({ visible, children }: { visible: boolean; children?: unknown }) =>
      visible ? React.createElement('BottomDrawer', { visible }, children) : null
  }
})

const MODEL_DESCRIPTOR: SessionOptionDescriptor = {
  id: 'model',
  label: 'Model',
  category: 'model',
  kind: {
    type: 'select',
    currentValue: 'sonnet',
    choices: [
      { value: 'sonnet', label: 'Sonnet 5' },
      { value: 'opus', label: 'Opus 4.8', description: 'Most capable' }
    ]
  },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
}

const EFFORT_DESCRIPTOR: SessionOptionDescriptor = {
  id: 'effort',
  label: 'Effort',
  category: 'thought_level',
  kind: {
    type: 'select',
    currentValue: 'high',
    choices: [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' }
    ]
  },
  valueSource: 'dispatched',
  transport: 'catalog',
  settable: true
}

const ACCESS_CHOICES = [
  { value: 'inherit', label: 'inherit' },
  { value: 'default', label: 'default' },
  { value: 'auto', label: 'auto' },
  { value: 'full-access', label: 'full-access' }
]

const accessWith = (currentValue: string): SessionOptionDescriptor => ({
  id: 'accessMode',
  label: 'accessMode',
  category: 'mode',
  kind: { type: 'select', currentValue, choices: ACCESS_CHOICES },
  valueSource: 'reported',
  transport: 'agent-session',
  settable: true
})

const FAST_MODE_DESCRIPTOR: SessionOptionDescriptor = {
  id: 'fastMode',
  label: 'Fast mode',
  category: 'mode',
  kind: { type: 'boolean', currentValue: false },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
}

const FAST_MODE_ON: SessionOptionDescriptor = {
  ...FAST_MODE_DESCRIPTOR,
  kind: { type: 'boolean', currentValue: true }
}

describe('MobileNativeChatSessionOptionPickers', () => {
  let renderer: ReactTestRenderer | null = null
  const setOption = vi.fn<MobileNativeChatSessionOptionsController['setOption']>()
  const invokeAction = vi.fn<MobileNativeChatSessionOptionsController['invokeAction']>()

  const mount = (
    snapshot: SessionOptionDescriptor[],
    isWorking = false,
    agent: string | null = null
  ): void => {
    const controller: MobileNativeChatSessionOptionsController = {
      snapshot,
      pendingId: null,
      setOption,
      invokeAction,
      recordCommand: vi.fn()
    }
    act(() => {
      renderer = create(
        createElement(MobileNativeChatSessionOptionPickers, { controller, isWorking, agent })
      )
    })
  }

  // Pressable whose accessible name starts with `name`; `find` requires exactly one.
  const control = (name: string): ReactTestInstance =>
    renderer!.root.find(
      (node) =>
        node.type === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(name)
    )

  const controls = (name: string): ReactTestInstance[] =>
    renderer!.root.findAll(
      (node) =>
        node.type === 'Pressable' &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith(name)
    )

  const texts = (): unknown[] =>
    renderer!.root.findAll((node) => node.type === 'Text').map((node) => node.props.children)

  // Rows live in the open sheet; the model pill also shows the model name as text.
  const rowByText = (text: string): ReactTestInstance => {
    const label = renderer!.root
      .findByType('BottomDrawer')
      .findAll((node) => node.type === 'Text')
      .find((node) => node.props.children === text)
    if (!label) {
      throw new Error(`No row labeled ${text}`)
    }
    let parent = label.parent
    while (parent && parent.type !== 'Pressable') {
      parent = parent.parent
    }
    if (!parent) {
      throw new Error(`No pressable row for ${text}`)
    }
    return parent
  }

  beforeEach(() => {
    setOption.mockReset()
    setOption.mockResolvedValue(true)
    invokeAction.mockReset()
    invokeAction.mockResolvedValue(true)
  })
  afterEach(() => {
    act(() => {
      renderer?.unmount()
    })
    renderer = null
  })

  it('renders nothing without a model descriptor', () => {
    mount([])
    expect(renderer!.toJSON()).toBeNull()
  })

  it('shows only the model name in the model pill', () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR])
    expect(control('Model').props).toMatchObject({
      accessibilityLabel: 'Model, Sonnet 5',
      accessibilityRole: 'button',
      disabled: false
    })
    expect(texts()).toContain('Sonnet 5')
    expect(texts()).not.toContain('Sonnet 5 High')
  })

  it('gives effort and access their own buttons, labelled with their current value', () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR, accessWith('default')])
    expect(control('Effort').props.accessibilityLabel).toBe('Effort, High')
    expect(control('Access').props.accessibilityLabel).toBe('Access, Ask for approval')
  })

  it('hides the effort and access buttons when the snapshot has neither', () => {
    mount([MODEL_DESCRIPTOR])
    expect(controls('Effort')).toHaveLength(0)
    expect(controls('Access')).toHaveLength(0)
  })

  it('opens the model sheet and applies a picked model', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    expect(renderer!.root.findByType('BottomDrawer').props.visible).toBe(true)
    await act(async () => rowByText('Opus 4.8').props.onPress())
    expect(setOption).toHaveBeenCalledWith('model', 'opus')
  })

  it('opens the effort sheet from its button with a close control and applies a pick', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR])
    await act(async () => control('Effort').props.onPress())
    expect(texts()).toContain('Select effort')
    expect(control('Close picker').props.accessibilityLabel).toBe('Close picker')
    expect(controls('Back to models')).toHaveLength(0)
    await act(async () => rowByText('Low').props.onPress())
    expect(setOption).toHaveBeenCalledWith('effort', 'low')
  })

  it('opens the access sheet with human labels and applies the picked mode', async () => {
    mount([MODEL_DESCRIPTOR, accessWith('default')])
    await act(async () => control('Access').props.onPress())
    expect(texts()).toContain('Select access')
    expect(texts()).toEqual(
      expect.arrayContaining(['Inherit global setting', 'Ask for approval', 'Auto', 'Full access'])
    )
    await act(async () => rowByText('Auto').props.onPress())
    expect(setOption).toHaveBeenCalledWith('accessMode', 'auto')
  })

  it('keeps fast mode in the model sheet and leaves effort and access out of it', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR, accessWith('default'), FAST_MODE_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Off').props.accessibilityLabel).toBe('Fast mode, Off')
    expect(texts()).not.toContain('Effort')
    expect(texts()).not.toContain('Access')
  })

  it('returns from an option opened off the model sheet to the model list', async () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    await act(async () => rowByText('Off').props.onPress())
    expect(control('Back to models').props.accessibilityLabel).toBe('Back to models')
    await act(async () => control('Back to models').props.onPress())
    expect(texts()).toContain('Select model')
  })

  it('announces choice selection and disabled state', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR])
    expect(control('Model').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { disabled: false }
    })
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Sonnet 5').props).toMatchObject({
      accessibilityRole: 'radio',
      accessibilityState: { checked: true, disabled: false }
    })
    expect(rowByText('Opus 4.8').props.accessibilityState?.checked).toBe(false)
  })

  it('closes without dispatch when re-picking the tracked value', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    await act(async () => rowByText('Sonnet 5').props.onPress())
    expect(setOption).not.toHaveBeenCalled()
  })

  it('renders agent-picker descriptors as a single action row', async () => {
    mount([
      {
        ...MODEL_DESCRIPTOR,
        kind: { type: 'select', choices: [] },
        valueSource: 'unknown',
        transport: 'catalog',
        action: { type: 'agent-picker' }
      }
    ])
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Choose in agent picker…').props.accessibilityRole).toBe('button')
    await act(async () => rowByText('Choose in agent picker…').props.onPress())
    expect(invokeAction).toHaveBeenCalledWith('model')
  })

  // The terminal transport can only learn the outcome by parsing the screen back,
  // so the sheet admits the value is unconfirmed; the structured transport reports
  // it every turn, which makes the same caption noise there.
  it.each([
    { transport: 'catalog' as const, caption: true },
    { transport: 'agent-session' as const, caption: false }
  ])('captions a dispatched value only on the terminal transport', async (scenario) => {
    mount([
      MODEL_DESCRIPTOR,
      { ...EFFORT_DESCRIPTOR, valueSource: 'dispatched', transport: scenario.transport }
    ])
    await act(async () => control('Effort').props.onPress())
    const captions = renderer!.root
      .findAll((node) => node.type === 'Text')
      .filter((node) => node.props.children === 'Sent to the agent — not confirmed')
    expect(captions.length > 0).toBe(scenario.caption)
  })

  it.each(['catalog', 'agent-session'] as const)(
    'does not caption a reported value on the %s transport',
    async (transport) => {
      mount([MODEL_DESCRIPTOR, { ...EFFORT_DESCRIPTOR, valueSource: 'reported', transport }])
      await act(async () => control('Effort').props.onPress())
      expect(
        renderer!.root
          .findAll((node) => node.type === 'Text')
          .some((node) => node.props.children === 'Sent to the agent — not confirmed')
      ).toBe(false)
    }
  )

  it('locks the model pill and the effort and access buttons while the agent is working', () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR, accessWith('default')], true)
    expect(control('Model').props).toMatchObject({ disabled: true })
    expect(control('Effort').props.accessibilityState).toMatchObject({ disabled: true })
    expect(control('Access').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('names fast mode in the model pill and shows the amber bolt only while it is on', () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_ON])
    expect(control('Model').props.accessibilityLabel).toBe('Model, Sonnet 5, fast mode')
    const bolts = renderer!.root.findAll((node) => node.type === 'Zap')
    expect(bolts).toHaveLength(1)
    expect(bolts[0]!.props.color).toBe(colors.statusAmber)
  })

  it('shows no bolt and no fast-mode name when fast mode is off', () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_DESCRIPTOR])
    expect(control('Model').props.accessibilityLabel).toBe('Model, Sonnet 5')
    expect(renderer!.root.findAll((node) => node.type === 'Zap')).toHaveLength(0)
  })

  it('leads the model pill with the agent icon only when an agent is known', () => {
    mount([MODEL_DESCRIPTOR], false, 'claude')
    expect(renderer!.root.findByType('MobileAgentIcon').props).toMatchObject({
      agentId: 'claude',
      size: 16
    })
  })

  it('renders no agent icon when no agent is known', () => {
    mount([MODEL_DESCRIPTOR])
    expect(renderer!.root.findAll((node) => node.type === 'MobileAgentIcon')).toHaveLength(0)
  })

  it.each([
    {
      value: 'default',
      icon: 'Lock',
      color: colors.textSecondary,
      label: 'Access, Ask for approval'
    },
    { value: 'auto', icon: 'LockOpen', color: colors.statusAmber, label: 'Access, Auto' },
    {
      value: 'full-access',
      icon: 'LockOpen',
      color: colors.statusRed,
      label: 'Access, Full access'
    }
  ])('draws access $value as $icon in its tone', ({ value, icon, color, label }) => {
    mount([MODEL_DESCRIPTOR, accessWith(value)])
    expect(control('Access').props.accessibilityLabel).toBe(label)
    const glyphs = renderer!.root.findAll((node) => node.type === icon)
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0]!.props.color).toBe(color)
  })

  it('tints the full-access choice label in the danger colour inside its sheet', async () => {
    mount([MODEL_DESCRIPTOR, accessWith('default')])
    await act(async () => control('Access').props.onPress())
    const [label] = renderer!.root.findAll(
      (node) => node.type === 'Text' && node.props.children === 'Full access'
    )
    expect(label!.props.style).toEqual(expect.arrayContaining([{ color: colors.statusRed }]))
  })
})
