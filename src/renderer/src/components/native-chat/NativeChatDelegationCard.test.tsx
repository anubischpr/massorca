// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DelegationCardPayload } from '../../../../shared/delegated-session-journal'
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
})

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

describe('NativeChatDelegationCard', () => {
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
})
