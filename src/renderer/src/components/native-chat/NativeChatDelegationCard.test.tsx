// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import type { DelegationCardPayload } from '../../../../shared/delegated-session-journal'
import type { PrototypeSystemCard } from '../../../../shared/prototype-design-system-card'
import type {
  DelegationAgentUsage,
  DelegationDecision
} from '../../../../shared/delegated-session-types'
import { NativeChatDelegationCard } from './NativeChatDelegationCard'

function usage(agent: string, overrides: Partial<DelegationAgentUsage> = {}): DelegationAgentUsage {
  return {
    agent,
    bindingPercent: 34,
    window: 'weekly',
    noData: false,
    excluded: null,
    ...overrides
  }
}

const codexUsage = usage('codex')
const claudeUsage = usage('claude', { bindingPercent: 72, window: 'session' })
const limitUsage = usage('opencode', {
  bindingPercent: 100,
  window: null,
  excluded: 'limit-reached'
})

const decision: DelegationDecision = {
  agent: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  tier: 3,
  dimensions: { risk: 'low', complexity: 'medium', verifiability: 'medium', ambiguity: 'medium' },
  placement: 'current',
  placementWarning: null,
  ranking: [codexUsage, claudeUsage, limitUsage],
  reasons: ['lowest-usage', 'read-only-current-worktree']
}

const payload: DelegationCardPayload = {
  requestId: 'req-1',
  title: 'Explore Gentle Shell v5',
  decision,
  agents: [
    { agent: 'codex', label: 'Codex', usage: codexUsage, model: 'gpt-6.1-sol', effort: 'medium' },
    { agent: 'claude', label: 'Claude', usage: claudeUsage, model: 'sonnet', effort: 'medium' },
    { agent: 'opencode', label: 'OpenCode', usage: limitUsage, model: null, effort: null }
  ],
  placement: 'current',
  placementWarning: null
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useAppStore.setState({ settings: null })
})

function setViewerCount(count: number): void {
  useAppStore.setState({
    settings: { ...getDefaultSettings('/tmp'), prototypeCount: { mode: 'ask', count } }
  })
}

const EXISTING_SYSTEM: PrototypeSystemCard = {
  kind: 'existing',
  projectKey: 'nexuscare',
  projectName: 'NexusCare',
  version: 1,
  tokenCount: 24,
  sourceNames: ['main.css'],
  swatches: ['#111111', '#ffffff', '#888888', '#22aa55']
}
const NO_SYSTEM: PrototypeSystemCard = {
  kind: 'none',
  projectKey: 'nexuscare',
  projectName: 'NexusCare'
}

function systemButtons(): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label^="Design system"] button, [role="group"][aria-label^="No design system"] button'
    )
  ]
}

function renderCard(
  body: DelegationCardPayload,
  options: { isSubmitting?: boolean } = {}
): { onAnswer: ReturnType<typeof vi.fn>; onCancel: ReturnType<typeof vi.fn> } {
  const onAnswer = vi.fn()
  const onCancel = vi.fn()
  act(() =>
    root.render(
      <NativeChatDelegationCard
        body={body}
        question="Which agent should handle this session?"
        questionId="q1"
        isSubmitting={options.isSubmitting}
        onAnswer={onAnswer}
        onCancel={onCancel}
      />
    )
  )
  return { onAnswer, onCancel }
}

function choices(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button[role="radio"]')]
}

function click(node: HTMLButtonElement | undefined): void {
  if (!node) {
    throw new Error('Missing button')
  }
  act(() => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function footerButton(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.trim() === text
  )
}

function startButton(): HTMLButtonElement {
  const button = footerButton('Start child session') ?? footerButton('Starting…')
  if (!button) {
    throw new Error('Missing start button')
  }
  return button
}

function countButtons(): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label="How many prototypes?"] button'
    )
  ]
}

describe('NativeChatDelegationCard', () => {
  it('names the request it asks about, since the question is the same for all', () => {
    renderCard(payload)
    expect(container.textContent).toContain('Explore Gentle Shell v5')
  })

  it('starts with Automatic chosen and says which agent it picked', () => {
    renderCard(payload)
    expect(choices().map((button) => button.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false'
    ])
    expect(container.textContent).toContain('Automatic picked Codex')
    expect(startButton().disabled).toBe(false)
  })

  it('says this month for a monthly-only reading', () => {
    const monthly = usage('pi', { bindingPercent: 42, window: null, monthly: true })
    renderCard({
      ...payload,
      decision: { ...decision, agent: 'pi', ranking: [monthly] },
      agents: [{ agent: 'pi', label: 'Gentle Shell', usage: monthly, model: null, effort: null }]
    })
    expect(container.textContent).toContain('42% used this month')
  })

  it('answers Automatic through its option id', () => {
    const { onAnswer } = renderCard(payload)
    click(startButton())
    expect(onAnswer).toHaveBeenCalledWith({
      kind: 'answers',
      answers: [{ questionId: 'q1', optionIds: ['automatic'] }]
    })
  })

  it("answers with the agent the person picked and shows that agent's own model", () => {
    const { onAnswer } = renderCard(payload)
    click(choices()[2])
    expect(container.textContent).not.toContain('Automatic picked')
    expect(container.textContent).toContain('sonnet · medium')
    click(startButton())
    expect(onAnswer).toHaveBeenCalledWith({
      kind: 'answers',
      answers: [{ questionId: 'q1', optionIds: ['agent:claude'] }]
    })
  })

  it('waits for a pick when no agent has headroom', () => {
    const { onAnswer } = renderCard({ ...payload, decision: null })
    expect(choices()).toHaveLength(3)
    expect(startButton().disabled).toBe(true)
    click(startButton())
    expect(onAnswer).not.toHaveBeenCalled()
    click(choices()[0])
    click(startButton())
    expect(onAnswer).toHaveBeenCalledWith({
      kind: 'answers',
      answers: [{ questionId: 'q1', optionIds: ['agent:codex'] }]
    })
  })

  it('names a reached limit and a percentage for the others', () => {
    renderCard(payload)
    expect(container.textContent).toContain('Limit reached')
    expect(container.textContent).toContain('72% used')
  })

  it('cancels through the cancel button', () => {
    const { onCancel } = renderCard(payload)
    click(footerButton('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('holds every choice and the start button while the answer is delivered', () => {
    const { onAnswer } = renderCard(payload, { isSubmitting: true })
    expect(choices().every((button) => button.disabled)).toBe(true)
    expect(startButton().textContent?.trim()).toBe('Starting…')
    click(startButton())
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('offers the count question with the Settings default highlighted, for a task that asks for prototypes', () => {
    renderCard({ ...payload, prototypeCount: { choices: [1, 2, 3], defaultCount: 2 } })
    expect(countButtons().map((button) => button.textContent)).toEqual(['1', '2', '3'])
    expect(countButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false'
    ])
  })

  it('keeps the Automatic explanation beside the count question, with the buttons outside the scrolling choices', () => {
    renderCard({ ...payload, prototypeCount: { choices: [1, 2, 3], defaultCount: 2 } })

    const scroller = container.querySelector('.overflow-y-auto')
    expect(scroller?.textContent).toContain('How many prototypes?')
    expect(scroller?.textContent).toContain('Automatic picked Codex')
    expect(scroller?.contains(startButton())).toBe(false)
    expect(scroller?.contains(footerButton('Cancel') ?? null)).toBe(false)
  })

  it('sends the count the person picked with the agent answer', () => {
    const { onAnswer } = renderCard({
      ...payload,
      prototypeCount: { choices: [1, 2, 3], defaultCount: 2 }
    })
    click(countButtons()[2])
    expect(countButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true'
    ])
    click(startButton())
    expect(onAnswer).toHaveBeenCalledWith(
      { kind: 'answers', answers: [{ questionId: 'q1', optionIds: ['automatic'] }] },
      3,
      undefined
    )
  })

  it('sends the count it shows highlighted when the person picked none', () => {
    const { onAnswer } = renderCard({
      ...payload,
      prototypeCount: { choices: [1, 2, 3], defaultCount: 2 }
    })
    click(startButton())
    expect(onAnswer).toHaveBeenCalledOnce()
    expect(onAnswer.mock.calls[0]?.[1]).toBe(2)
  })

  it("highlights and sends the viewer's own Settings count over the host's default", () => {
    setViewerCount(3)
    const { onAnswer } = renderCard({
      ...payload,
      prototypeCount: { choices: [1, 2, 3], defaultCount: 2 }
    })
    expect(countButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true'
    ])
    click(startButton())
    expect(onAnswer.mock.calls[0]?.[1]).toBe(3)
  })

  it('keeps the host default when the viewer Settings count is one the card does not offer', () => {
    setViewerCount(4)
    const { onAnswer } = renderCard({
      ...payload,
      prototypeCount: { choices: [1, 2, 3], defaultCount: 2 }
    })
    click(startButton())
    expect(onAnswer.mock.calls[0]?.[1]).toBe(2)
  })

  it('sends no count and no design system for a card that draws neither, an older host', () => {
    const { onAnswer } = renderCard(payload)
    click(startButton())
    expect(onAnswer.mock.calls[0]).toHaveLength(1)
  })

  it('asks Use it and Review first for an existing design system, and sends use', () => {
    const { onAnswer } = renderCard({
      ...payload,
      prototypeCount: { choices: [1, 2, 3], defaultCount: 3 },
      designSystem: EXISTING_SYSTEM
    })
    expect(systemButtons().map((button) => button.textContent)).toEqual(['Use it', 'Review first'])
    expect(container.textContent).toContain(
      'v1 · 24 tokens from main.css. All 3 directions will use it.'
    )
    click(startButton())
    expect(onAnswer.mock.calls[0]?.slice(1)).toEqual([3, 'use'])
  })

  it('asks Propose one first or Skip for a project with no system, and sends the pick', () => {
    const { onAnswer } = renderCard({ ...payload, designSystem: NO_SYSTEM })
    expect(systemButtons().map((button) => button.textContent)).toEqual([
      'Propose one first',
      'Skip'
    ])
    expect(systemButtons().map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false'
    ])
    click(systemButtons()[1])
    click(startButton())
    expect(onAnswer.mock.calls[0]?.slice(1)).toEqual([undefined, 'skip'])
  })

  it('offers no count question for a task that asks for no prototype', () => {
    renderCard(payload)
    expect(countButtons()).toHaveLength(0)
  })
})
