// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeSystemCard } from '../../../../shared/prototype-design-system-card'
import { NativeChatPrototypeSystemCard } from './NativeChatPrototypeSystemCard'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

const EXISTING: PrototypeSystemCard = {
  kind: 'existing',
  projectKey: 'nexus',
  projectName: 'nexuscare',
  version: 2,
  tokenCount: 24,
  sourceNames: ['main.css', 'STYLEGUIDE.md', 'ui'],
  swatches: ['#1d4ed8', '#0a0a0a', '#f5f5f5', '#16a34a']
}

const NONE: PrototypeSystemCard = {
  kind: 'none',
  projectKey: 'landing',
  projectName: 'landing-site'
}

function renderCard(
  overrides: {
    card?: PrototypeSystemCard
    count?: number
    onChoose?: (mode: 'use' | 'propose' | 'skip') => void
    onReview?: () => void
  } = {}
): { onChoose: ReturnType<typeof vi.fn>; onReview: ReturnType<typeof vi.fn> } {
  const onChoose = vi.fn(overrides.onChoose)
  const onReview = vi.fn(overrides.onReview)
  render(
    <NativeChatPrototypeSystemCard
      card={overrides.card ?? EXISTING}
      count={overrides.count ?? 2}
      agentName="Codex"
      onChoose={onChoose}
      onReview={onReview}
    />
  )
  return { onChoose, onReview }
}

describe('NativeChatPrototypeSystemCard for an existing system', () => {
  afterEach(cleanup)

  it('titles the card with its project and summarizes the system and its sources', () => {
    renderCard()
    expect(screen.getByRole('group', { name: 'Design system · nexuscare' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'v2 · 24 tokens from main.css, STYLEGUIDE.md and ui. Both directions will use it.'
      )
    ).toBeInTheDocument()
  })

  it('states what the directions do for one, two and three prototypes', () => {
    const { unmount } = render(
      <NativeChatPrototypeSystemCard
        card={EXISTING}
        count={1}
        agentName="Codex"
        onChoose={vi.fn()}
        onReview={vi.fn()}
      />
    )
    expect(screen.getByText(/The direction will use it\.$/u)).toBeInTheDocument()
    unmount()
    renderCard({ count: 3 })
    expect(screen.getByText(/All 3 directions will use it\.$/u)).toBeInTheDocument()
  })

  it('names the source in the line without "from" when the system has no sources', () => {
    renderCard({ card: { ...EXISTING, sourceNames: [] } })
    expect(screen.getByText('v2 · 24 tokens. Both directions will use it.')).toBeInTheDocument()
  })

  it('shows its four swatches in order and the two buttons, Use it first', () => {
    const { container } = render(
      <NativeChatPrototypeSystemCard
        card={EXISTING}
        count={2}
        agentName="Codex"
        onChoose={vi.fn()}
        onReview={vi.fn()}
      />
    )
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Use it',
      'Review first'
    ])
  })

  it('answers Use it with the use mode, and Review first with its own action only', async () => {
    const user = userEvent.setup()
    const { onChoose, onReview } = renderCard()
    await user.click(screen.getByRole('button', { name: 'Use it' }))
    expect(onChoose).toHaveBeenCalledWith('use')
    await user.click(screen.getByRole('button', { name: 'Review first' }))
    expect(onReview).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledTimes(1)
  })
})

describe('NativeChatPrototypeSystemCard for a project with no design system', () => {
  afterEach(cleanup)

  it('says the project has none and that the agent proposes one first, naming the agent', () => {
    renderCard({ card: NONE })
    expect(
      screen.getByRole('group', { name: 'No design system in landing-site' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Codex will propose one first: tokens, components and 2 palettes. You review it before any direction is made.'
      )
    ).toBeInTheDocument()
  })

  it('offers Propose one first and Skip, and answers each with its mode', async () => {
    const user = userEvent.setup()
    const { onChoose, onReview } = renderCard({ card: NONE })
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Propose one first',
      'Skip'
    ])
    await user.click(screen.getByRole('button', { name: 'Propose one first' }))
    expect(onChoose).toHaveBeenLastCalledWith('propose')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onChoose).toHaveBeenLastCalledWith('skip')
    expect(onReview).not.toHaveBeenCalled()
  })
})
