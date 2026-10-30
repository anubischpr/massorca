// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { PrototypeMergeState } from '../../../../shared/prototype-merge-plan'
import { createSetState, type PrototypeSetState } from '../../../../shared/prototype-set-state'
import { PrototypeMergeReview } from './PrototypeMergeReview'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

type Update = Mock<(transform: (state: PrototypeSetState) => PrototypeSetState) => void>
type Review = Extract<PrototypeMergeState, { phase: 'review' }>

function review(overrides: Partial<Review> = {}): Review {
  return {
    phase: 'review',
    letters: ['A', 'C'],
    note: '',
    sending: false,
    parts: [
      { id: 0, name: 'Heading', selector: 'main > h1', suggested: 'A', from: 'A', on: true },
      { id: 1, name: 'Pay button', selector: 'button.cta', suggested: 'C', from: 'A', on: true },
      {
        id: 2,
        name: 'Order summary',
        selector: 'aside.summary',
        suggested: 'A',
        from: 'A',
        on: false
      }
    ],
    ...overrides
  }
}

function renderReview(
  value: Review,
  extra: { sendFailed?: boolean; onSend?: () => void; update?: Update } = {}
): Update {
  const update: Update = extra.update ?? vi.fn()
  render(
    <PrototypeMergeReview
      review={value}
      agent="Codex"
      nextLetter="D"
      sendFailed={extra.sendFailed ?? false}
      update={update}
      onSend={extra.onSend ?? vi.fn()}
    />
  )
  return update
}

function stateWith(merge: Review): PrototypeSetState {
  return { ...createSetState(['A', 'B', 'C']), merge, starred: ['A', 'C'] }
}

function applied(update: Update, state: PrototypeSetState): PrototypeSetState {
  const transform = update.mock.lastCall?.[0]
  if (transform === undefined) {
    throw new Error('expected the review to update the state')
  }
  return transform(state)
}

describe('PrototypeMergeReview', () => {
  afterEach(cleanup)

  it('titles the merge and says who suggested the sources', () => {
    renderReview(review())
    expect(screen.getByText('Merge A and C')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Codex suggested a source for each part. Change any of them, or leave a part out.'
      )
    ).toBeInTheDocument()
  })

  it('lists each part with its name, selector, source letters and marker', () => {
    renderReview(review())
    expect(screen.getByRole('checkbox', { name: /Heading/u })).toBeInTheDocument()
    expect(screen.getAllByText('main > h1')).toHaveLength(2)
    const source = screen.getByRole('group', { name: 'Source of Pay button' })
    expect(
      within(source)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['A', 'C'])
    expect(within(source).getByRole('button', { name: 'A' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(source).getByRole('button', { name: 'C' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByText('suggested')).toBeInTheDocument()
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(screen.getByText('left out')).toBeInTheDocument()
  })

  it('switches the source of a part to another starred letter', () => {
    const value = review()
    const update = renderReview(value)
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Source of Heading' })).getByRole('button', {
        name: 'C'
      })
    )
    const merge = applied(update, stateWith(value)).merge
    expect(merge?.phase === 'review' && merge.parts[0]?.from).toBe('C')
  })

  it('leaves a part out from its checkbox', () => {
    const value = review()
    const update = renderReview(value)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.map((box) => box.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
      'false'
    ])
    const [heading] = checkboxes
    if (heading === undefined) {
      throw new Error('expected a checkbox for the first part')
    }
    fireEvent.click(heading)
    const merge = applied(update, stateWith(value)).merge
    expect(merge?.phase === 'review' && merge.parts[0]?.on).toBe(false)
  })

  it('previews the plan as one row per kept part: its source letter, name and selector', () => {
    renderReview(review())
    expect(screen.getByText('D · preview of the plan')).toBeInTheDocument()
    const preview = screen.getByRole('list', { name: 'D · preview of the plan' })
    const [heading, pay] = within(preview).getAllByRole('listitem')
    if (heading === undefined || pay === undefined) {
      throw new Error('expected a preview row for each kept part')
    }
    expect(heading).toHaveTextContent('A')
    expect(within(heading).getByText('Heading')).toBeInTheDocument()
    expect(within(heading).getByText('main > h1')).toBeInTheDocument()
    expect(pay).toHaveTextContent('A')
    expect(within(pay).getByText('Pay button')).toBeInTheDocument()
    expect(within(pay).getByText('button.cta')).toBeInTheDocument()
    expect(within(preview).queryByText('Order summary')).toBeNull()
  })

  it('previews a source changed in the review, and no row for a part left out', () => {
    const changed = review({
      parts: review().parts.map((part) => (part.id === 1 ? { ...part, from: 'C' } : part))
    })
    renderReview(changed)
    const preview = screen.getByRole('list', { name: 'D · preview of the plan' })
    const [, pay] = within(preview).getAllByRole('listitem')
    expect(pay).toHaveTextContent('C')
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2)
  })

  it('takes the words under Anything else', () => {
    const value = review()
    const update = renderReview(value)
    expect(screen.getByText('Anything else')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('How the parts should fit together…'), {
      target: { value: 'Keep the heading small' }
    })
    const merge = applied(update, stateWith(value)).merge
    expect(merge?.phase === 'review' && merge.note).toBe('Keep the heading small')
  })

  it('cancels the merge and sends into the next letter', () => {
    const value = review()
    const onSend = vi.fn()
    const update = renderReview(value, { onSend })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(applied(update, stateWith(value)).merge).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Merge into D' }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('holds the send while nothing is kept or a send is in flight', () => {
    const none = review({
      parts: review().parts.map((part) => ({ ...part, on: false }))
    })
    renderReview(none)
    expect(screen.getByRole('button', { name: 'Merge into D' })).toBeDisabled()
    cleanup()
    renderReview(review({ sending: true }))
    expect(screen.getByRole('button', { name: 'Merge into D' })).toBeDisabled()
  })

  it('shows the send-failure line only after a refusal', () => {
    renderReview(review())
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    renderReview(review(), { sendFailed: true })
    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't send: the chat is no longer active. Your draft is kept."
    )
  })
})
