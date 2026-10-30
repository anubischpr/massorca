// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { PrototypeMergeState } from '../../../../shared/prototype-merge-plan'
import { createSetState, type PrototypeSetState } from '../../../../shared/prototype-set-state'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PrototypeMergeReview } from './PrototypeMergeReview'

const DIRECTIONS_HTML = {
  ready: true,
  htmlByLetter: {
    A: '<main><h1>Heading A</h1></main><aside class="summary">Summary A</aside><button class="pay">Pay A</button>',
    C: '<div class="hero"><h1>Hero C</h1></div><button class="cta">Pay C</button>'
  }
}

vi.mock('./use-prototype-direction-html', () => ({
  usePrototypeDirectionsHtml: () => DIRECTIONS_HTML
}))

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
      {
        id: 0,
        name: 'Heading',
        kind: 'section',
        selectors: { A: 'main > h1', C: '.hero h1' },
        selector: 'main > h1',
        suggested: 'A',
        from: 'A',
        on: true
      },
      {
        id: 1,
        name: 'Pay button',
        kind: 'component',
        selectors: { A: 'button.pay', C: 'button.cta' },
        selector: 'button.cta',
        suggested: 'C',
        from: 'A',
        on: true
      },
      {
        id: 2,
        name: 'Order summary',
        kind: 'section',
        selectors: { A: 'aside.summary' },
        selector: 'aside.summary',
        suggested: 'A',
        from: 'A',
        on: false
      },
      {
        id: 3,
        name: 'Timeline',
        kind: 'section',
        selectors: { C: '.timeline' },
        selector: '.timeline',
        suggested: 'C',
        from: 'C',
        on: true
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
    <TooltipProvider>
      <PrototypeMergeReview
        set={{ sessionId: 's1', requestId: 'r1', directions: [] }}
        review={value}
        agent="Codex"
        nextLetter="D"
        sendFailed={extra.sendFailed ?? false}
        update={update}
        onSend={extra.onSend ?? vi.fn()}
      />
    </TooltipProvider>
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

  it('groups the rows under Sections and Components', () => {
    renderReview(review())
    const headings = screen.getAllByText(/^(Sections|Components)$/u)
    expect(headings.map((heading) => heading.textContent)).toEqual(['Sections', 'Components'])
    const sections = headings[0]?.parentElement
    const components = headings[1]?.parentElement
    if (sections == null || components == null) {
      throw new Error('expected the two groups')
    }
    expect(within(sections).getAllByRole('checkbox')).toHaveLength(3)
    expect(within(sections).getByRole('checkbox', { name: /Heading/u })).toBeInTheDocument()
    expect(within(components).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(components).getByRole('checkbox', { name: /Pay button/u })).toBeInTheDocument()
  })

  it('leaves out the Components heading when no part is a component', () => {
    renderReview(review({ parts: review().parts.filter((part) => part.kind === 'section') }))
    expect(screen.queryByText('Components')).toBeNull()
    expect(screen.getByText('Sections')).toBeInTheDocument()
  })

  it('shows the chosen source selector and only the letters a part has', () => {
    renderReview(review())
    expect(screen.getAllByText('main > h1')).toHaveLength(1)
    expect(screen.getByText('button.pay')).toBeInTheDocument()
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
    const locked = within(screen.getByRole('group', { name: 'Source of Timeline' })).getAllByRole(
      'button'
    )
    expect(locked.map((button) => button.textContent)).toEqual(['C'])
    expect(locked[0]).toBeDisabled()
  })

  it('marks each part: suggested, changed, left out, only in, or no preview', () => {
    renderReview(review())
    expect(screen.getByText('suggested')).toBeInTheDocument()
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(screen.getByText('left out')).toBeInTheDocument()
    expect(screen.getByText('no preview')).toBeInTheDocument()
    expect(screen.getByText('no preview')).toHaveClass('text-status-amber')
  })

  it('marks a part present in one direction as only in that letter', () => {
    renderReview(
      review({
        parts: review().parts.map((part) =>
          part.id === 3 ? { ...part, selectors: { C: 'div.hero' } } : part
        )
      })
    )
    expect(screen.getByText('only in C')).toBeInTheDocument()
    expect(screen.queryByText('no preview')).toBeNull()
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
      'false',
      'true',
      'true'
    ])
    const [heading] = checkboxes
    if (heading === undefined) {
      throw new Error('expected a checkbox for the first part')
    }
    fireEvent.click(heading)
    const merge = applied(update, stateWith(value)).merge
    expect(merge?.phase === 'review' && merge.parts[0]?.on).toBe(false)
  })

  it('composes the preview from the directions in a frame with scripts and same-origin off', () => {
    renderReview(review())
    expect(screen.getByText('D · preview')).toBeInTheDocument()
    const frame = screen.getByTitle('D · preview')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    const document = frame.getAttribute('srcdoc') ?? ''
    expect(document).toContain('Heading A')
    expect(document).toContain('Pay A')
    expect(document).toContain('shadowrootmode="open"')
    expect(document).not.toContain('Summary A')
  })

  it('recomposes with the source the user chose, and drops a part left out', () => {
    renderReview(
      review({
        parts: review().parts.map((part) =>
          part.id === 0 ? { ...part, from: 'C' } : part.id === 1 ? { ...part, on: false } : part
        )
      })
    )
    const document = screen.getByTitle('D · preview').getAttribute('srcdoc') ?? ''
    expect(document).toContain('Hero C')
    expect(document).not.toContain('Heading A')
    expect(document).not.toContain('Pay A')
  })

  it('switches the preview between the desktop and phone views', () => {
    renderReview(review())
    expect(screen.getByTitle('D · preview')).not.toHaveClass('w-[390px]')
    fireEvent.click(screen.getByRole('button', { name: 'Phone view' }))
    expect(screen.getByTitle('D · preview')).toHaveClass('w-[390px]')
    expect(screen.getByRole('button', { name: 'Phone view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Desktop view' }))
    expect(screen.getByTitle('D · preview')).not.toHaveClass('w-[390px]')
  })

  it('outlines the hovered row in the preview', async () => {
    renderReview(review())
    expect(screen.getByTitle('D · preview').getAttribute('srcdoc')).not.toContain('outline:2px')
    const row = screen.getByRole('checkbox', { name: /Heading/u }).closest('div[class*="border"]')
    if (row === null) {
      throw new Error('expected the row of the first part')
    }
    fireEvent.mouseEnter(row)
    expect(row).toHaveClass('border-status-amber')
    await waitFor(() =>
      expect(screen.getByTitle('D · preview').getAttribute('srcdoc')).toMatch(
        /data-part="0"[^>]*outline:2px solid/u
      )
    )
    fireEvent.mouseLeave(row)
    await waitFor(() =>
      expect(screen.getByTitle('D · preview').getAttribute('srcdoc')).not.toContain('outline:2px')
    )
  })

  it('says in a tooltip that the preview is an approximation', async () => {
    renderReview(review())
    fireEvent.focus(screen.getByRole('button', { name: 'About the preview' }))
    const text =
      "This preview is an approximation. Codex generates the final result, and it may vary with the agent's ability."
    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
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
