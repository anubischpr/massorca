import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionModelCatalogResult } from '../../../src/shared/agent-session-wire'
import { CreateSessionComposerRow } from './CreateSessionComposerRow'
import {
  applyCreateSessionModelCatalog,
  createCreateSessionOptionDraft,
  createSessionOptionSnapshot
} from './create-session-option-draft'
import type { CreateSessionOptions } from './use-create-session-options'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ArrowUp: 'ArrowUp' }))
vi.mock('../session/MobileNativeChatSessionOptionPickers', () => ({
  MobileNativeChatSessionOptionPickers: 'OptionPickers'
}))

const noCatalog: CreateSessionOptions = {
  controller: {
    snapshot: [],
    pendingId: null,
    setOption: () => Promise.resolve(false),
    invokeAction: () => Promise.resolve(false),
    recordCommand: () => {}
  },
  picks: {},
  effectiveModelId: null
}

const withModelList: CreateSessionOptions = {
  ...noCatalog,
  controller: {
    ...noCatalog.controller,
    snapshot: createSessionOptionSnapshot(createCreateSessionOptionDraft('claude'))
  }
}

const antigravityModels: AgentSessionModelCatalogResult = {
  origin: 'probe',
  fetchedAt: 1,
  models: [{ id: 'gemini-pro', label: 'Gemini Pro', isDefault: true, efforts: [] }]
}

/** The options a create screen holds once the agent's host list has answered with `catalog`. */
function optionsWithHostList(
  agent: string,
  catalog: AgentSessionModelCatalogResult
): CreateSessionOptions {
  const draft = applyCreateSessionModelCatalog(createCreateSessionOptionDraft(agent), catalog)
  return {
    ...noCatalog,
    controller: { ...noCatalog.controller, snapshot: createSessionOptionSnapshot(draft) }
  }
}

function mount(props: {
  agent: string | null
  agentLabel: string
  options: CreateSessionOptions
  canSubmit: boolean
  onSubmit: () => void
}) {
  const mounted: { renderer: ReturnType<typeof create> | null } = { renderer: null }
  act(() => {
    mounted.renderer = create(createElement(CreateSessionComposerRow, props))
  })
  if (!mounted.renderer) {
    throw new Error('did not render')
  }
  return mounted.renderer.root
}

function textsOf(root: ReturnType<typeof mount>): string[] {
  return root.findAllByType('Text').map((text) => String(text.props.children))
}

describe('CreateSessionComposerRow', () => {
  it('keeps the create button disabled until there is something to send', () => {
    const root = mount({
      agent: 'claude',
      agentLabel: 'Claude',
      options: withModelList,
      canSubmit: false,
      onSubmit: vi.fn()
    })
    const button = root.findByProps({ accessibilityLabel: 'Create session' })
    expect(button.props.disabled).toBe(true)
    expect(button.props.accessibilityState).toEqual({ disabled: true })
  })

  it('creates the session when the button is pressed', () => {
    const onSubmit = vi.fn()
    const root = mount({
      agent: 'claude',
      agentLabel: 'Claude',
      options: withModelList,
      canSubmit: true,
      onSubmit
    })
    const button = root.findByProps({ accessibilityLabel: 'Create session' })
    expect(button.props.disabled).toBe(false)
    act(() => button.props.onPress())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('names the default model of an agent with no model list instead of leaving the row blank', () => {
    const root = mount({
      agent: 'antigravity',
      agentLabel: 'Antigravity',
      options: noCatalog,
      canSubmit: false,
      onSubmit: vi.fn()
    })
    expect(textsOf(root)).toContain('Antigravity · default model')
    expect(root.findAllByType('OptionPickers')).toHaveLength(0)
    expect(root.findByProps({ accessibilityLabel: 'Create session' })).toBeDefined()
  })

  it('shows the model picker, not the default label, when the agent has a model list', () => {
    const root = mount({
      agent: 'claude',
      agentLabel: 'Claude',
      options: withModelList,
      canSubmit: false,
      onSubmit: vi.fn()
    })
    expect(root.findAllByType('OptionPickers')).toHaveLength(1)
    expect(textsOf(root).some((text) => text.includes('default model'))).toBe(false)
  })

  it('shows neither picker nor label before an agent is picked', () => {
    const root = mount({
      agent: null,
      agentLabel: 'Agent',
      options: noCatalog,
      canSubmit: false,
      onSubmit: vi.fn()
    })
    expect(root.findAllByType('OptionPickers')).toHaveLength(0)
    expect(textsOf(root)).toEqual([])
  })

  it('shows the model picker for Antigravity once its host lists models', () => {
    const root = mount({
      agent: 'antigravity',
      agentLabel: 'Antigravity',
      options: optionsWithHostList('antigravity', antigravityModels),
      canSubmit: false,
      onSubmit: vi.fn()
    })
    expect(root.findAllByType('OptionPickers')).toHaveLength(1)
    expect(textsOf(root).some((text) => text.includes('default model'))).toBe(false)
  })

  it('keeps the default model label for Antigravity while its host list is empty', () => {
    const root = mount({
      agent: 'antigravity',
      agentLabel: 'Antigravity',
      options: optionsWithHostList('antigravity', { origin: 'unknown' }),
      canSubmit: false,
      onSubmit: vi.fn()
    })
    expect(root.findAllByType('OptionPickers')).toHaveLength(0)
    expect(textsOf(root)).toContain('Antigravity · default model')
  })
})
