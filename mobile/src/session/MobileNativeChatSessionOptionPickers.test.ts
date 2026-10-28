import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'
import { colors } from '../theme/mobile-theme'
import { MobileNativeChatEffortMeter } from './MobileNativeChatEffortMeter'
import { MobileNativeChatSessionOptionPickers } from './MobileNativeChatSessionOptionPickers'
import type { MobileNativeChatSessionOptionsController } from './use-mobile-native-chat-session-options'

const viewport = vi.hoisted(() => ({ width: 390 }))
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Keyboard: { dismiss: vi.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Switch: 'Switch',
  Text: 'Text',
  useWindowDimensions: () => ({ width: viewport.width, height: 844 }),
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

// Claude's list as the host reports it: the built-in aliases beside pinned and 1M-context rows.
const claudeModels = (currentValue: string): SessionOptionDescriptor => ({
  ...MODEL_DESCRIPTOR,
  kind: {
    type: 'select',
    currentValue,
    choices: [
      { value: 'default', label: 'Default (recommended)' },
      { value: 'opus', label: 'Opus' },
      { value: 'opus[1m]', label: 'Opus (1M context)' },
      { value: 'sonnet', label: 'Sonnet' },
      { value: 'sonnet[1m]', label: 'Sonnet (1M context)' },
      { value: 'haiku', label: 'Haiku' },
      { value: 'fable', label: 'Fable' }
    ]
  }
})

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

const EFFORT_THREE_LEVELS: SessionOptionDescriptor = {
  ...EFFORT_DESCRIPTOR,
  kind: {
    type: 'select',
    currentValue: 'medium',
    choices: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ]
  },
  valueSource: 'reported'
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

// A select-type option other than effort or access keeps its summary row and drill-in.
const SERVICE_TIER_DESCRIPTOR: SessionOptionDescriptor = {
  id: 'serviceTier',
  label: 'Service tier',
  category: 'mode',
  kind: {
    type: 'select',
    currentValue: 'default',
    choices: [
      { value: 'default', label: 'Standard' },
      { value: 'priority', label: 'Priority' }
    ]
  },
  valueSource: 'reported',
  transport: 'catalog',
  settable: true
}

describe('MobileNativeChatSessionOptionPickers', () => {
  let renderer: ReactTestRenderer | null = null
  const setOption = vi.fn<MobileNativeChatSessionOptionsController['setOption']>()
  const invokeAction = vi.fn<MobileNativeChatSessionOptionsController['invokeAction']>()

  const pickers = (
    snapshot: SessionOptionDescriptor[],
    optionPickerRequest: MobileNativeChatSessionOptionsController['optionPickerRequest'] = null,
    isWorking = false,
    agent: string | null = null,
    piRuntime?: PiRowRuntime
  ): React.ReactElement => {
    const controller: MobileNativeChatSessionOptionsController = {
      snapshot,
      pendingId: null,
      setOption,
      invokeAction,
      recordCommand: vi.fn(),
      optionPickerRequest
    }
    return createElement(MobileNativeChatSessionOptionPickers, {
      controller,
      isWorking,
      agent,
      piRuntime
    })
  }

  const mount = (
    snapshot: SessionOptionDescriptor[],
    isWorking = false,
    agent: string | null = null,
    piRuntime?: PiRowRuntime
  ): void => {
    act(() => {
      renderer = create(pickers(snapshot, null, isWorking, agent, piRuntime))
    })
  }

  // A new request object is what the host sends for each external request.
  const requestPicker = (
    snapshot: SessionOptionDescriptor[],
    id: string,
    sequence: number
  ): void => {
    act(() => {
      renderer!.update(pickers(snapshot, { id, sequence }))
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

  // The inline switch an open model sheet renders for a boolean option, found by its label.
  const switchFor = (label: string): ReactTestInstance => {
    const found = renderer!.root
      .findByType('BottomDrawer')
      .findAll((node) => node.type === 'Switch' && node.props.accessibilityLabel === label)
    if (found.length !== 1) {
      throw new Error(`Expected one switch labeled ${label}, found ${found.length}`)
    }
    return found[0]!
  }

  beforeEach(() => {
    viewport.width = 390
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

  it('shows a disabled Loading… pill with no effort or access buttons while the options are pending', () => {
    const unknownModel: SessionOptionDescriptor = {
      id: 'model',
      label: 'Model',
      category: 'model',
      kind: { type: 'select', choices: [] },
      valueSource: 'unknown',
      transport: 'agent-session',
      settable: false,
      disabledReason: 'available-after-session-start'
    }
    act(() => {
      renderer = create(
        createElement(MobileNativeChatSessionOptionPickers, {
          controller: {
            snapshot: [unknownModel],
            pendingId: null,
            setOption,
            invokeAction,
            recordCommand: vi.fn(),
            loading: true
          },
          isWorking: false
        })
      )
    })
    expect(control('Model').props).toMatchObject({
      accessibilityLabel: 'Model, Loading…',
      disabled: true
    })
    expect(texts()).toContain('Loading…')
    expect(controls('Effort')).toHaveLength(0)
    expect(controls('Access')).toHaveLength(0)
  })

  it('keeps a known model name enabled while the options answer is still pending', () => {
    act(() => {
      renderer = create(
        createElement(MobileNativeChatSessionOptionPickers, {
          controller: {
            snapshot: [MODEL_DESCRIPTOR],
            pendingId: null,
            setOption,
            invokeAction,
            recordCommand: vi.fn(),
            loading: true
          },
          isWorking: false
        })
      )
    })
    expect(control('Model').props).toMatchObject({
      accessibilityLabel: 'Model, Sonnet 5',
      disabled: false
    })
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

  it('keeps fast mode in the model sheet as an inline switch and leaves effort and access out of it', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR, accessWith('default'), FAST_MODE_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    expect(controls('Fast mode')).toHaveLength(0)
    expect(switchFor('Fast mode').props.value).toBe(false)
    expect(texts()).not.toContain('Effort')
    expect(texts()).not.toContain('Access')
  })

  it('turns fast mode on inline without opening another view or closing the model sheet', async () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    await act(async () => switchFor('Fast mode').props.onValueChange(true))
    expect(setOption).toHaveBeenCalledWith('fastMode', true)
    expect(renderer!.root.findByType('BottomDrawer').props.visible).toBe(true)
    expect(texts()).toContain('Select model')
    expect(controls('Back to models')).toHaveLength(0)
  })

  it('does not re-dispatch fast mode when its tracked value is picked again', async () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_ON])
    await act(async () => control('Model').props.onPress())
    await act(async () => switchFor('Fast mode').props.onValueChange(true))
    expect(setOption).not.toHaveBeenCalled()
  })

  it('locks the inline fast mode switch while the agent is working', async () => {
    mount([MODEL_DESCRIPTOR, FAST_MODE_DESCRIPTOR], true)
    await act(async () => control('Model').props.onPress())
    expect(switchFor('Fast mode').props.disabled).toBe(true)
  })

  it('keeps a select option other than effort or access as a summary row that drills in', async () => {
    mount([MODEL_DESCRIPTOR, SERVICE_TIER_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    expect(controls('Service tier')).toHaveLength(1)
    expect(renderer!.root.findAll((node) => node.type === 'Switch')).toHaveLength(0)
  })

  it('returns from an option opened off the model sheet to the model list', async () => {
    mount([MODEL_DESCRIPTOR, SERVICE_TIER_DESCRIPTOR])
    await act(async () => control('Model').props.onPress())
    await act(async () => rowByText('Service tier').props.onPress())
    expect(control('Back to models').props.accessibilityLabel).toBe('Back to models')
    await act(async () => control('Back to models').props.onPress())
    expect(texts()).toContain('Select model')
  })

  it('shows the Gentle Shell icon for a Gentle Shell chat instead of the Pi mark', () => {
    mount([MODEL_DESCRIPTOR], false, 'pi', 'gentle-shell')
    expect(renderer!.root.findByType('MobileAgentIcon').props).toMatchObject({
      agentId: 'pi',
      piRuntime: 'gentle-shell'
    })
  })

  it('keeps the Pi mark for a stock Pi chat with no runtime', () => {
    mount([MODEL_DESCRIPTOR], false, 'pi', 'pi')
    expect(renderer!.root.findByType('MobileAgentIcon').props).toMatchObject({
      agentId: 'pi',
      piRuntime: 'pi'
    })
  })

  it('passes no runtime to the icon when a Pi chat reports none', () => {
    mount([MODEL_DESCRIPTOR], false, 'pi')
    expect(renderer!.root.findByType('MobileAgentIcon').props.piRuntime).toBeUndefined()
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

  it('renders agent-picker descriptors as a row that says it changes the model in the terminal', async () => {
    mount(
      [
        {
          ...MODEL_DESCRIPTOR,
          kind: { type: 'select', choices: [] },
          valueSource: 'unknown',
          transport: 'catalog',
          action: { type: 'agent-picker' }
        }
      ],
      false,
      'codex'
    )
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Change in the terminal').props.accessibilityRole).toBe('button')
    expect(texts()).toContain("Opens Codex's own model picker in the terminal")
    await act(async () => rowByText('Change in the terminal').props.onPress())
    expect(invokeAction).toHaveBeenCalledWith('model')
  })

  it('says why effort and access are missing on a terminal model sheet', async () => {
    mount(
      [
        {
          ...MODEL_DESCRIPTOR,
          label: "Agent's model",
          kind: { type: 'select', choices: [] },
          valueSource: 'unknown',
          transport: 'catalog',
          action: { type: 'agent-picker' }
        }
      ],
      false,
      'codex'
    )
    await act(async () => control('Model').props.onPress())
    expect(texts()).toContain('Effort appears once the agent reports its model.')
    expect(texts()).toContain(
      "This terminal chat doesn't report an access mode, so it isn't shown here."
    )
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

  it('leads each effort row with its meter level and says what each level means', async () => {
    mount([MODEL_DESCRIPTOR, EFFORT_THREE_LEVELS])
    await act(async () => control('Effort').props.onPress())
    const levels = renderer!.root
      .findByType('BottomDrawer')
      .findAll((node) => node.type === MobileNativeChatEffortMeter)
      .map((node) => node.props.level)
    expect(levels).toEqual([2, 3, 5])
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Quick replies, minimal thinking',
        'Balanced thinking',
        'Thinks longer before answering'
      ])
    )
  })

  it('draws each access row in its tone and says what each mode does', async () => {
    mount([MODEL_DESCRIPTOR, accessWith('default')])
    await act(async () => control('Access').props.onPress())
    const sheet = renderer!.root.findByType('BottomDrawer')
    const colorsOf = (glyph: string): unknown[] =>
      sheet.findAll((node) => node.type === glyph).map((node) => node.props.color)
    expect(colorsOf('LockOpen')).toEqual([colors.statusAmber, colors.statusRed])
    expect(colorsOf('Lock')).toEqual([colors.textSecondary, colors.textSecondary])
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Uses the global access setting',
        'Asks before edits and commands',
        'Decides on its own what needs approval',
        'Never asks. Runs anything.'
      ])
    )
  })

  it('describes an inherited access row by the mode it resolves to', async () => {
    mount([MODEL_DESCRIPTOR, { ...accessWith('default'), inheritedAccess: 'full-access' }])
    await act(async () => control('Access').props.onPress())
    expect(texts()).toContain('Uses the global access setting (Full access)')
  })

  it('lists the built-in Claude models and folds the host rows behind More models with its count', async () => {
    mount([claudeModels('opus')], false, 'claude')
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Opus').props.accessibilityState).toMatchObject({ checked: true })
    expect(control('More models').props.accessibilityLabel).toBe('More models, 3')
    expect(() => rowByText('Opus (1M context)')).toThrow('No row labeled Opus (1M context)')
  })

  it('opens More models, picks a folded model there, and applies it', async () => {
    mount([claudeModels('opus')], false, 'claude')
    await act(async () => control('Model').props.onPress())
    await act(async () => control('More models').props.onPress())
    expect(texts()).toContain('More models')
    expect(controls('More models')).toHaveLength(0)
    await act(async () => rowByText('Sonnet (1M context)').props.onPress())
    expect(setOption).toHaveBeenCalledWith('model', 'sonnet[1m]')
  })

  it('returns from More models to the featured list with the back control', async () => {
    mount([claudeModels('opus')], false, 'claude')
    await act(async () => control('Model').props.onPress())
    await act(async () => control('More models').props.onPress())
    await act(async () => control('Back to models').props.onPress())
    expect(texts()).toContain('Select model')
    expect(rowByText('Opus').props.accessibilityRole).toBe('radio')
  })

  it('keeps the selected folded model featured and counts only the rest under More models', async () => {
    mount([claudeModels('sonnet[1m]')], false, 'claude')
    await act(async () => control('Model').props.onPress())
    expect(rowByText('Sonnet (1M context)').props.accessibilityState).toMatchObject({
      checked: true
    })
    expect(control('More models').props.accessibilityLabel).toBe('More models, 2')
  })

  it('shows every model and no More models row for an agent without a featured rule', async () => {
    mount([claudeModels('opus')])
    await act(async () => control('Model').props.onPress())
    expect(controls('More models')).toHaveLength(0)
    expect(rowByText('Opus (1M context)').props.accessibilityRole).toBe('radio')
  })

  it('hides More models when every Claude model is a built-in alias', async () => {
    mount(
      [
        {
          ...MODEL_DESCRIPTOR,
          kind: {
            type: 'select',
            currentValue: 'opus',
            choices: [
              { value: 'opus', label: 'Opus' },
              { value: 'sonnet', label: 'Sonnet' },
              { value: 'haiku', label: 'Haiku' },
              { value: 'fable', label: 'Fable' }
            ]
          }
        }
      ],
      false,
      'claude'
    )
    await act(async () => control('Model').props.onPress())
    expect(controls('More models')).toHaveLength(0)
  })
  it('opens an externally requested effort sheet with the close control, not back to models', () => {
    const snapshot = [MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR]
    mount(snapshot)
    requestPicker(snapshot, 'effort', 1)
    expect(renderer!.root.findByType('BottomDrawer').props.visible).toBe(true)
    expect(texts()).toContain('Select effort')
    expect(control('Close picker').props.accessibilityLabel).toBe('Close picker')
    expect(controls('Back to models')).toHaveLength(0)
  })

  it('opens an externally requested access sheet with the close control, not back to models', () => {
    const snapshot = [MODEL_DESCRIPTOR, accessWith('default')]
    mount(snapshot)
    requestPicker(snapshot, 'accessMode', 1)
    expect(texts()).toContain('Select access')
    expect(control('Close picker').props.accessibilityLabel).toBe('Close picker')
    expect(controls('Back to models')).toHaveLength(0)
  })

  it('keeps Back to models for an externally requested option from the model sheet', () => {
    const snapshot = [MODEL_DESCRIPTOR, SERVICE_TIER_DESCRIPTOR]
    mount(snapshot)
    requestPicker(snapshot, 'serviceTier', 1)
    expect(texts()).toContain('Select service tier')
    expect(control('Back to models').props.accessibilityLabel).toBe('Back to models')
  })

  it('ignores a request for a descriptor missing from the snapshot and still opens a later valid one', () => {
    const snapshot = [MODEL_DESCRIPTOR, EFFORT_DESCRIPTOR]
    mount(snapshot)
    requestPicker(snapshot, 'serviceTier', 1)
    expect(renderer!.root.findAll((node) => node.type === 'BottomDrawer')).toHaveLength(0)
    requestPicker(snapshot, 'effort', 2)
    expect(renderer!.root.findByType('BottomDrawer').props.visible).toBe(true)
    expect(texts()).toContain('Select effort')
  })

  it('drops the model name from the pill below 360pt but keeps the icon and the model in its name', () => {
    viewport.width = 320
    mount([MODEL_DESCRIPTOR], false, 'claude')
    expect(renderer!.root.findByType('MobileAgentIcon')).toBeDefined()
    expect(texts()).not.toContain('Sonnet 5')
    expect(control('Model').props.accessibilityLabel).toBe('Model, Sonnet 5')
  })

  it('shows the model name in the pill at 390pt', () => {
    mount([MODEL_DESCRIPTOR], false, 'claude')
    expect(texts()).toContain('Sonnet 5')
  })

  it('always shows the model name in the pill when no agent icon can stand in', () => {
    viewport.width = 320
    mount([MODEL_DESCRIPTOR])
    expect(texts()).toContain('Sonnet 5')
  })

  it.each([
    { note: 'no-restricted-mode' as const, text: 'Pi chat has no restricted mode.' },
    {
      note: 'start-only-modes' as const,
      text: 'Dimmed modes can only be set when the session starts.'
    },
    { note: 'applies-on-next-start' as const, text: 'Changes apply when the session next starts.' }
  ])('captions a sheet whose descriptor carries the $note note', async ({ note, text }) => {
    mount([MODEL_DESCRIPTOR, { ...SERVICE_TIER_DESCRIPTOR, note }])
    await act(async () => control('Model').props.onPress())
    await act(async () => rowByText('Service tier').props.onPress())
    expect(texts()).toContain(text)
  })

  it.each([
    { value: 'full-access', tinted: true },
    { value: 'auto', tinted: false },
    { value: 'default', tinted: false }
  ])('tints the access button background only for danger, not for $value', ({ value, tinted }) => {
    mount([MODEL_DESCRIPTOR, accessWith(value)])
    const style = control('Access').props.style({ pressed: false }) as unknown[]
    if (tinted) {
      expect(style).toContainEqual({ backgroundColor: colors.statusRedTint })
    } else {
      expect(style).not.toContainEqual({ backgroundColor: colors.statusRedTint })
    }
  })

  it('names an effort with no reported value "Effort, Not set" rather than "Effort, Effort"', () => {
    mount([MODEL_DESCRIPTOR, { ...EFFORT_DESCRIPTOR, valueSource: 'unknown' }])
    expect(control('Effort').props.accessibilityLabel).toBe('Effort, Not set')
  })

  it('names an access mode with no human label "Custom mode" instead of its transport token', () => {
    mount([MODEL_DESCRIPTOR, accessWith('acceptEditsLegacy')])
    expect(control('Access').props.accessibilityLabel).toBe('Access, Custom mode')
  })
})
