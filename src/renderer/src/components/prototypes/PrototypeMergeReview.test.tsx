// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PrototypeMergeReviewPart } from '../../../../shared/prototype-merge-plan'
import { PrototypeMergeReview } from './PrototypeMergeReview'

const directions = vi.hoisted(() => ({
  ready: true,
  htmlByLetter: {
    A: '<main><h1>Title A</h1></main><footer>Foot A</footer>',
    C: '<main><h1>Title C</h1></main><footer>Foot C</footer>'
  }
}))

vi.mock('@/i18n/i18n', () => ({
  i18n: {},
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

vi.mock('./use-prototype-direction-html', () => ({
  usePrototypeDirectionsHtml: () => directions
}))

const SET = { sessionId: 'session-1', requestId: 'request-1', directions: [] }

function part(
  id: number,
  name: string,
  selector: string,
  from: 'A' | 'C'
): PrototypeMergeReviewPart {
  return {
    id,
    name,
    kind: 'section',
    selectors: { A: selector, C: selector },
    selector,
    suggested: from,
    from,
    on: true
  }
}

const REVIEW = {
  phase: 'review' as const,
  letters: ['A', 'C'],
  parts: [part(0, 'Heading', 'main > h1', 'A'), part(1, 'Footer', 'footer', 'C')],
  note: '',
  sending: false
}

function renderReview(review: typeof REVIEW, update = vi.fn()): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <PrototypeMergeReview
        set={SET}
        review={review}
        agent="claude"
        nextLetter="D"
        sendFailed={false}
        update={update}
        onSend={vi.fn()}
      />
    </TooltipProvider>
  )
}

function previewFrame(): HTMLElement {
  return screen.getByTitle('D · preview')
}

function sourceButton(partName: string, letter: string): HTMLElement {
  return within(screen.getByRole('group', { name: `Source of ${partName}` })).getByRole('button', {
    name: letter
  })
}

describe('PrototypeMergeReview preview', () => {
  let pages = 0

  beforeEach(() => {
    pages = 0
    URL.createObjectURL = vi.fn(() => {
      pages += 1
      return `blob:page-${pages}`
    })
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(cleanup)

  it('opens the composed page at its top, before any part is changed', () => {
    renderReview(REVIEW)
    expect(previewFrame()).toHaveAttribute('src', 'blob:page-1')
  })

  it('moves to the section of a change without making a new page for the move', () => {
    renderReview(REVIEW)
    fireEvent.click(sourceButton('Footer', 'A'))
    expect(previewFrame()).toHaveAttribute('src', 'blob:page-1#merge-part-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('moves to the changed section of a new page when the change rewrites the page', () => {
    const update = vi.fn()
    const { rerender } = renderReview(REVIEW, update)
    fireEvent.click(sourceButton('Heading', 'C'))
    const changed = {
      ...REVIEW,
      parts: [part(0, 'Heading', 'main > h1', 'C'), REVIEW.parts[1]]
    }
    rerender(
      <TooltipProvider>
        <PrototypeMergeReview
          set={SET}
          review={changed}
          agent="claude"
          nextLetter="D"
          sendFailed={false}
          update={update}
          onSend={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(previewFrame()).toHaveAttribute('src', 'blob:page-2#merge-part-0')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-1')
  })

  it('does not reload the page when a row is hovered', () => {
    renderReview(REVIEW)
    fireEvent.mouseEnter(screen.getByText('Footer'))
    expect(previewFrame()).toHaveAttribute('src', 'blob:page-1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})
