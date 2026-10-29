import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DelegationCardPayload } from '../../../src/shared/delegated-session-journal'
import type { DelegationAgentUsage } from '../../../src/shared/delegated-session-types'
import { renderedTexts } from '../test-support/rendered-texts'
import { MobileNativeChatDelegationCard } from './MobileNativeChatDelegationCard'
import type { MobileDelegationQuestion } from './mobile-delegation-card-model'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  X: 'X'
}))
// Why: the sheet's own rendering is covered by its model tests; here only its open state matters.
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))

function usage(
  agent: string,
  bindingPercent: number,
  overrides: Partial<DelegationAgentUsage> = {}
): DelegationAgentUsage {
  return { agent, bindingPercent, window: 'weekly', noData: false, excluded: null, ...overrides }
}

const card: DelegationCardPayload = {
  requestId: 'request-1',
  title: 'Explore Gentle Shell v5',
  decision: {
    agent: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'medium',
    tier: 3,
    dimensions: { risk: 'low', complexity: 'medium', verifiability: 'medium', ambiguity: 'medium' },
    placement: 'current',
    placementWarning: null,
    ranking: [usage('codex', 34), usage('claude', 72, { excluded: 'usage-limit' })],
    reasons: ['lowest-usage']
  },
  agents: [
    {
      agent: 'codex',
      label: 'Codex',
      usage: usage('codex', 34),
      model: 'gpt-6.1-sol',
      effort: 'medium'
    },
    {
      agent: 'antigravity',
      label: 'Antigravity',
      usage: usage('antigravity', 41),
      model: null,
      effort: null
    },
    {
      agent: 'claude',
      label: 'Claude',
      usage: usage('claude', 72),
      model: 'sonnet',
      effort: 'medium'
    }
  ],
  placement: 'current',
  placementWarning: null
}

// Antigravity has no answer token, so the card must not offer it.
const delegation: MobileDelegationQuestion = {
  card,
  answerTokens: {
    automatic: 'token-automatic',
    'agent:codex': 'token-codex',
    'agent:claude': 'token-claude'
  }
}

describe('MobileNativeChatDelegationCard', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  async function mount(props: {
    onAnswer?: (text: string) => Promise<boolean>
    onCancel?: () => Promise<boolean>
    payload?: MobileDelegationQuestion
  }) {
    await act(async () => {
      renderer = create(
        createElement(MobileNativeChatDelegationCard, {
          question: 'Which agent should handle this session?',
          delegation: props.payload ?? delegation,
          onAnswer: props.onAnswer ?? (async () => true),
          onCancel: props.onCancel
        })
      )
    })
    return renderer!
  }

  function radios() {
    return renderer!.root.findAllByProps({ accessibilityRole: 'radio' })
  }

  function startButton() {
    return renderer!.root.findByProps({ accessibilityLabel: 'Start child session' })
  }

  function texts(): string[] {
    return renderedTexts(renderer!.toJSON())
  }

  it('says this month for a monthly-only reading', async () => {
    const monthly = usage('codex', 42, { window: null, monthly: true })
    await mount({
      payload: {
        ...delegation,
        card: {
          ...card,
          decision: null,
          agents: [{ agent: 'codex', label: 'Codex', usage: monthly, model: null, effort: null }]
        }
      }
    })
    expect(texts()).toContain('42% used this month')
  })

  it('offers Automatic first, then the agents it can answer for, and starts on Automatic', async () => {
    await mount({})

    expect(radios().map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Automatic',
      'Codex',
      'Claude'
    ])
    expect(radios()[0]!.props.accessibilityState).toEqual({ checked: true, disabled: false })
    expect(texts()).toContain('Picks Codex · gpt-6.1-sol · medium')
    expect(texts()).toContain('Picks Codex')
  })

  it('answers with the chosen option token', async () => {
    const onAnswer = vi.fn(async () => true)
    await mount({ onAnswer })

    await act(async () => startButton().props.onPress())
    expect(onAnswer).toHaveBeenLastCalledWith('token-automatic')

    await act(async () => radios()[2]!.props.onPress())
    expect(texts()).not.toContain('Picks Codex · gpt-6.1-sol · medium')
    await act(async () => startButton().props.onPress())
    expect(onAnswer).toHaveBeenLastCalledWith('token-claude')
  })

  it('keeps Start disabled until a row is picked when there is no decision', async () => {
    const onAnswer = vi.fn(async () => true)
    await mount({
      onAnswer,
      payload: {
        card: { ...card, decision: null },
        answerTokens: { 'agent:codex': 'token-codex' }
      }
    })

    expect(radios().map((radio) => radio.props.accessibilityLabel)).toEqual(['Codex'])
    expect(radios()[0]!.props.accessibilityState.checked).toBe(false)
    expect(startButton().props.disabled).toBe(true)
    await act(async () => startButton().props.onPress())
    expect(onAnswer).not.toHaveBeenCalled()

    await act(async () => radios()[0]!.props.onPress())
    expect(startButton().props.disabled).toBe(false)
    await act(async () => startButton().props.onPress())
    expect(onAnswer).toHaveBeenCalledWith('token-codex')
  })

  it('picks nothing when the question carries no answer for Automatic', async () => {
    await mount({ payload: { card, answerTokens: { 'agent:codex': 'token-codex' } } })

    expect(radios().map((radio) => radio.props.accessibilityLabel)).toEqual(['Codex'])
    expect(radios()[0]!.props.accessibilityState.checked).toBe(false)
    expect(startButton().props.disabled).toBe(true)
    expect(texts()).not.toContain('Picks Codex · gpt-6.1-sol · medium')
    expect(
      renderer!.root.findAll(
        (node) => node.props.accessibilityLabel === 'Why Automatic picked this agent'
      )
    ).toHaveLength(0)
  })

  it('opens the why sheet from the Automatic pick', async () => {
    await mount({})
    expect(texts()).not.toContain('Why Automatic picked Codex')

    await act(async () =>
      renderer!.root
        .findByProps({ accessibilityLabel: 'Why Automatic picked this agent' })
        .props.onPress()
    )
    // Why: the sheet is a lazy import, so its words arrive once that module has loaded.
    await vi.waitFor(
      async () => {
        await act(async () => {})
        expect(texts()).toContain('Why Automatic picked Codex')
      },
      { timeout: 5000 }
    )

    expect(texts()).toContain('1 · Agent: lowest usage')
  })

  it('sends one answer while the first is pending', async () => {
    let settle: (accepted: boolean) => void = () => {}
    const onAnswer = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve
        })
    )
    await mount({ onAnswer })

    await act(async () => startButton().props.onPress())
    expect(texts()).toContain('Starting…')
    expect(startButton().props.disabled).toBe(true)
    await act(async () => startButton().props.onPress())
    expect(onAnswer).toHaveBeenCalledTimes(1)

    await act(async () => settle(true))
    expect(texts()).toContain('Start child session')
  })

  it('cancels through the prompt cancel path and draws no Cancel without one', async () => {
    const onCancel = vi.fn(async () => true)
    await mount({ onCancel })
    await act(async () =>
      renderer!.root.findByProps({ accessibilityLabel: 'Cancel' }).props.onPress()
    )
    expect(onCancel).toHaveBeenCalledTimes(1)

    act(() => renderer?.unmount())
    await mount({})
    expect(renderer!.root.findAllByProps({ accessibilityLabel: 'Cancel' })).toHaveLength(0)
  })

  it('never starts on a row the card stops drawing after a re-render', async () => {
    const onAnswer = vi.fn(async () => true)
    await mount({ onAnswer })
    expect(radios()[0]!.props.accessibilityState.checked).toBe(true)

    await act(async () => {
      renderer!.update(
        createElement(MobileNativeChatDelegationCard, {
          question: 'Which agent should handle this session?',
          delegation: {
            card: { ...card, decision: null },
            answerTokens: { automatic: 'token-automatic', 'agent:codex': 'token-codex' }
          },
          onAnswer
        })
      )
    })

    expect(radios().map((radio) => radio.props.accessibilityLabel)).toEqual(['Codex'])
    expect(radios()[0]!.props.accessibilityState.checked).toBe(false)
    expect(startButton().props.disabled).toBe(true)
    await act(async () => startButton().props.onPress())
    expect(onAnswer).not.toHaveBeenCalled()
  })
})
