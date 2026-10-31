// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualPickedElement
} from '../../../../shared/native-chat-visual-annotate'
import { beginMerge } from '../../../../shared/prototype-merge-state'
import {
  createSetState,
  makeMain,
  openDirection,
  pickElement,
  pinKeyFor,
  setNote,
  setPrompt,
  showSet,
  toggleStar,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { PrototypeViewer } from './PrototypeViewer'
import { usePrototypeViewStore } from './prototype-view-store'

const frame = vi.hoisted(() => {
  const captured: { onAnnotateEvent: ((event: NativeChatVisualAnnotateEvent) => void) | null } = {
    onAnnotateEvent: null
  }
  return captured
})

vi.mock('@/i18n/i18n', () => ({
  i18n: {},
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

vi.mock('react-i18next', () => ({
  Trans: ({ defaults }: { defaults: string }) => (
    <span>{defaults.replace(/<\/?letter>/gu, '')}</span>
  )
}))

vi.mock('@/lib/structured-agent-session-tab-activation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  activateStructuredAgentSessionById: vi.fn()
}))

vi.mock('@/lib/worktree-activation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('./use-prototype-file-html', () => ({ usePrototypeFileHtml: () => null }))

vi.mock('./use-prototype-direction-html', () => ({
  usePrototypeDirectionsHtml: () => ({ ready: false, htmlByLetter: {} })
}))

vi.mock('./PrototypeThumbnail', () => ({ PrototypeThumbnail: () => null }))

vi.mock('./PrototypeFrame', () => ({
  PrototypeFrame: (props: { onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void }) => {
    frame.onAnnotateEvent = props.onAnnotateEvent
    return <div data-testid="frame" />
  }
}))

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

const SET: PrototypeListedSet = {
  requestId: '20261028-201500-aaaaaa',
  sessionId: 'session-alpha-0001',
  agent: 'claude',
  worktreeId: null,
  chatTitle: 'Checkout',
  originalPrompt: 'a checkout page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 2,
  directions: [
    {
      letter: 'A',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/A.html', mtime: 1 }]
    },
    {
      letter: 'B',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/B.html', mtime: 1 }]
    }
  ]
}

const PICKED: NativeChatVisualPickedElement = {
  selector: 'button.cta',
  label: 'pay button',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  htmlSnippet: '<button>Pay now</button>',
  state: {
    text: 'Pay now',
    color: '#ffffff',
    bg: '#171717',
    width: { value: 100, unit: '%' },
    height: { value: 48, unit: 'px' },
    fontSize: 14
  }
}

function renderViewer(state: PrototypeSetState, update: Update): void {
  render(
    <TooltipProvider>
      <PrototypeViewer
        set={SET}
        state={state}
        update={update}
        frameBoxRef={createRef<HTMLDivElement>()}
        onOpenDesignSystem={vi.fn()}
        nextLetter="C"
        onMerge={vi.fn()}
        onSendMerge={vi.fn()}
      />
    </TooltipProvider>
  )
}

describe('PrototypeViewer header', () => {
  afterEach(cleanup)

  it('shows the title and the direction count, without the iterating letter', () => {
    renderViewer(createSetState(['A', 'B']), vi.fn<Update>())
    const header = screen.getByText(/· 2 directions$/)
    expect(header.textContent).toBe('Checkout · 2 directions')
  })
})

describe('PrototypeViewer side panel toggle', () => {
  beforeEach(() => {
    usePrototypeViewStore.setState({ sidePanelHidden: false, states: {} })
  })
  afterEach(cleanup)

  it('hides the panel from a button named Hide panel, and shows it again as Show panel', () => {
    renderViewer(createSetState(['A', 'B']), vi.fn<Update>())
    fireEvent.click(screen.getByRole('button', { name: 'Hide panel' }))
    expect(usePrototypeViewStore.getState().sidePanelHidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show panel' }))
    expect(usePrototypeViewStore.getState().sidePanelHidden).toBe(false)
    expect(screen.getByRole('button', { name: 'Hide panel' })).toBeInTheDocument()
  })

  it('takes the secondary look while hidden, and leaves the set state alone', () => {
    const update = vi.fn<Update>()
    renderViewer(createSetState(['A', 'B']), update)
    fireEvent.click(screen.getByRole('button', { name: 'Hide panel' }))
    expect(screen.getByRole('button', { name: 'Show panel' })).toHaveAttribute(
      'data-variant',
      'secondary'
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('brings the hidden panel back when an element is picked, and keeps the draft', () => {
    const drafted = setNote(
      setPrompt(pickElement(createSetState(['A', 'B']), PICKED), 'keep this prompt'),
      'Make it sticky'
    )
    usePrototypeViewStore.setState({
      sidePanelHidden: true,
      states: { [SET.requestId]: drafted }
    })
    const update = vi.fn<Update>()
    renderViewer(drafted, update)

    act(() => {
      frame.onAnnotateEvent?.({
        kind: 'element-picked',
        element: { ...PICKED, selector: 'div.summary', label: 'summary' }
      })
    })

    expect(usePrototypeViewStore.getState().sidePanelHidden).toBe(false)
    expect(screen.getByRole('button', { name: 'Hide panel' })).toBeInTheDocument()
    const transform = update.mock.lastCall?.[0]
    const next = transform?.(drafted)
    expect(next?.prompt).toBe('keep this prompt')
    expect(next?.notes[`A:${pinKeyFor('button.cta')}`]).toBe('Make it sticky')
  })

  it('brings the hidden panel back when a pin is clicked', () => {
    usePrototypeViewStore.setState({ sidePanelHidden: true })
    renderViewer(createSetState(['A', 'B']), vi.fn<Update>())

    act(() => {
      frame.onAnnotateEvent?.({ kind: 'pin-clicked', pinKey: pinKeyFor('button.cta') })
    })

    expect(usePrototypeViewStore.getState().sidePanelHidden).toBe(false)
  })
})

const SET3: PrototypeListedSet = {
  ...SET,
  count: 3,
  folderPath: '/chat/prototypes/20261028-201500-aaaaaa',
  directions: [
    ...SET.directions,
    {
      letter: 'C',
      name: 'Express pay first',
      versions: [{ version: 2, fileName: 'prototypes/20261028-201500-aaaaaa/C-v2.html', mtime: 1 }]
    }
  ]
}

function renderSet3(
  state: PrototypeSetState,
  update: Update = vi.fn<Update>(),
  extra: { onMerge?: () => void; nextLetter?: string | null; set?: PrototypeListedSet } = {}
): Update {
  render(
    <TooltipProvider>
      <PrototypeViewer
        set={extra.set ?? SET3}
        state={state}
        update={update}
        frameBoxRef={createRef<HTMLDivElement>()}
        onOpenDesignSystem={vi.fn()}
        nextLetter={extra.nextLetter === undefined ? 'D' : extra.nextLetter}
        onMerge={extra.onMerge ?? vi.fn()}
        onSendMerge={vi.fn()}
      />
    </TooltipProvider>
  )
  return update
}

/** The state the last update leaves when applied to the state the viewer was given. */
function applied(update: Update, state: PrototypeSetState): PrototypeSetState {
  const transform = vi.mocked(update).mock.lastCall?.[0]
  if (transform === undefined) {
    throw new Error('expected the viewer to update the state')
  }
  return transform(state)
}

function mainB(): PrototypeSetState {
  return makeMain(openDirection(createSetState(['A', 'B', 'C']), 'B'))
}

describe('PrototypeViewer strip', () => {
  afterEach(cleanup)

  it('shows the main first, tagged main, with the read-only directions nested under it', () => {
    renderSet3(mainB())
    const strip = screen.getByRole('group', { name: 'Directions in this set' })
    expect(within(strip).getByText('Set of 3')).toBeInTheDocument()
    const nested = within(strip).getByRole('group', { name: 'Read-only directions' })
    const letterOf = (button: HTMLElement): string | null =>
      button.getAttribute('aria-label')?.replace('Show direction ', '') ?? null
    const shown = within(strip)
      .getAllByRole('button', { name: /^Show direction/u })
      .map(letterOf)
    expect(shown).toEqual(['B', 'A', 'C'])
    expect(
      within(nested)
        .getAllByRole('button', { name: /^Show direction/u })
        .map(letterOf)
    ).toEqual(['A', 'C'])
    const mainTag = within(screen.getByRole('button', { name: 'Show direction B' }))
    expect(mainTag.getByText('main')).toBeInTheDocument()
    expect(within(nested).getAllByText('read-only')).toHaveLength(2)
  })

  it('tags a merged direction with the directions it came from once it is not the main', () => {
    const state: PrototypeSetState = {
      ...createSetState(['A', 'B', 'C']),
      mergedFrom: { C: ['A', 'B'] }
    }
    renderSet3(state)
    expect(
      within(screen.getByRole('button', { name: 'Show direction C' })).getByText('A + B')
    ).toBeInTheDocument()
  })

  it('opens a direction without changing the main', () => {
    const state = createSetState(['A', 'B', 'C'])
    const update = renderSet3(state)
    fireEvent.click(screen.getByRole('button', { name: 'Show direction C' }))
    expect(applied(update, state)).toMatchObject({ active: 'A', view: 'C' })
  })
})

describe('PrototypeViewer View all and Design main', () => {
  afterEach(cleanup)

  it('names the layout buttons View all and Design main', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    const layout = screen.getByRole('group', { name: 'Layout' })
    expect(within(layout).getByRole('button', { name: 'View all' })).toBeInTheDocument()
    expect(within(layout).getByRole('button', { name: 'Design main' })).toBeInTheDocument()
  })

  it('a card opens its direction and never changes the main', () => {
    const state = showSet(createSetState(['A', 'B', 'C']))
    const update = renderSet3(state)
    fireEvent.click(screen.getByRole('button', { name: 'Open direction C' }))
    expect(applied(update, state)).toMatchObject({ layout: 'focus', active: 'A', view: 'C' })
  })

  it('puts a star on every card, as a button that tells whether it is starred', () => {
    const update = renderSet3(toggleStar(showSet(createSetState(['A', 'B', 'C'])), 'B'))
    expect(screen.getByRole('button', { name: 'Unstar B for merge' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const star = screen.getByRole('button', { name: 'Star A for merge' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(star)
    expect(applied(update, createSetState(['A', 'B', 'C'])).starred).toEqual(['A'])
  })
})

describe('PrototypeViewer read-only banner', () => {
  afterEach(cleanup)

  it('says which direction is read-only and where the main is', () => {
    renderSet3(openDirection(createSetState(['A', 'B', 'C']), 'C'))
    expect(screen.getByRole('status').textContent).toContain(
      'Viewing C, read-only. Select any element to see its properties; notes and edits go on the main, A.'
    )
  })

  it('offers Back to main as the primary button and Make main as the outline one', () => {
    renderSet3(openDirection(createSetState(['A', 'B', 'C']), 'C'))
    expect(screen.getByRole('button', { name: 'Back to main' })).toHaveAttribute(
      'data-variant',
      'default'
    )
    expect(screen.getByRole('button', { name: 'Make main' })).toHaveAttribute(
      'data-variant',
      'outline'
    )
  })

  it('goes back to the main, and makes the direction on screen the main', () => {
    const state = openDirection(createSetState(['A', 'B', 'C']), 'C')
    const update = renderSet3(state)
    fireEvent.click(screen.getByRole('button', { name: 'Back to main' }))
    expect(applied(update, state)).toMatchObject({ active: 'A', view: 'A' })
    fireEvent.click(screen.getByRole('button', { name: 'Make main' }))
    expect(applied(update, state)).toMatchObject({ active: 'C', view: 'C' })
  })

  it('is not shown on the main', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tags the line above the frame as main with its version, or read-only, with the hint', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.getByText('A · main · v1 · click any element to add a note')).toBeInTheDocument()
    cleanup()
    renderSet3(openDirection(createSetState(['A', 'B', 'C']), 'C'))
    expect(
      screen.getByText(
        'C · Express pay first · read-only · click any element to see its properties'
      )
    ).toBeInTheDocument()
  })

  it('says merged from A + B on the line of a merged main', () => {
    renderSet3({ ...createSetState(['A', 'B', 'C']), mergedFrom: { A: ['B', 'C'] } })
    expect(screen.getByText(/^A · main · merged from B \+ C · /u)).toBeInTheDocument()
  })
})

describe('PrototypeViewer Merge button', () => {
  afterEach(cleanup)

  it('is disabled below two stars and reads Merge', () => {
    renderSet3(toggleStar(createSetState(['A', 'B', 'C']), 'A'))
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Merge' }).textContent).toBe('1')
    cleanup()
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled()
  })

  it('shows the star count and asks for the suggestion at two stars', () => {
    const onMerge = vi.fn()
    renderSet3(toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'), vi.fn<Update>(), {
      onMerge
    })
    const button = screen.getByRole('button', { name: 'Merge (2)' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onMerge).toHaveBeenCalledTimes(1)
  })

  it('stays disabled while a merge is under way or no letter is free', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    renderSet3(
      { ...stars, merge: { phase: 'waiting', letters: ['A', 'C'], planId: 'p', baseline: null } },
      vi.fn<Update>()
    )
    expect(screen.getByRole('button', { name: 'Merge (2)' })).toBeDisabled()
    cleanup()
    renderSet3(stars, vi.fn<Update>(), { nextLetter: null })
    expect(screen.getByRole('button', { name: 'Merge (2)' })).toBeDisabled()
  })

  it('is disabled when the host did not report the request folder', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    const { folderPath: _folderPath, ...withoutFolder } = SET3
    renderSet3(stars, vi.fn<Update>(), { set: withoutFolder })
    expect(screen.getByRole('button', { name: 'Merge (2)' })).toBeDisabled()
  })

  it('reads Merge beside its count and pulses with a rainbow border at two stars', () => {
    renderSet3(toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'))
    const button = screen.getByRole('button', { name: 'Merge (2)' })
    expect(button).toBeEnabled()
    expect(button).toHaveClass('prototype-merge-ready')
    expect(button.textContent).toBe('Merge2')
  })

  it('stays icon-only with a tooltip below two stars, and loses the pulse while a merge waits', () => {
    renderSet3(toggleStar(createSetState(['A', 'B', 'C']), 'A'))
    const one = screen.getByRole('button', { name: 'Merge' })
    expect(one).not.toHaveClass('prototype-merge-ready')
    expect(one.textContent).toBe('1')
    cleanup()
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    renderSet3({
      ...stars,
      merge: { phase: 'waiting', letters: ['A', 'C'], planId: 'p', baseline: null }
    })
    const waiting = screen.getByRole('button', { name: 'Merge (2)' })
    expect(waiting).toBeDisabled()
    expect(waiting).not.toHaveClass('prototype-merge-ready')
  })

  it('comes before the Layout group, and a single direction has none', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    const merge = screen.getByRole('button', { name: 'Merge' })
    const layout = screen.getByRole('group', { name: 'Layout' })
    expect(merge.compareDocumentPosition(layout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
    renderSet3(createSetState(['A']), vi.fn<Update>(), {
      set: { ...SET, directions: SET.directions.slice(0, 1) }
    })
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull()
  })
})

describe('PrototypeViewer while a merge waits', () => {
  afterEach(cleanup)

  it('leaves the main area blank, with no frame, banner or hint, and keeps the strip and the row', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    renderSet3({
      ...stars,
      merge: { phase: 'waiting', letters: ['A', 'C'], planId: 'p', baseline: null }
    })
    expect(screen.queryByTestId('frame')).toBeNull()
    expect(screen.queryByText(/click any element/u)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Processing merge')
    expect(screen.getByRole('group', { name: 'Directions in this set' })).toBeInTheDocument()
  })

  it('shows the progress row from the click, and its Cancel ends the wait and keeps the stars', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    const state = beginMerge(stars, { planId: 'p' })
    const update = vi.fn<Update>()
    renderSet3(state, update)
    expect(screen.getByRole('status')).toHaveTextContent('Processing merge')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const next = applied(update, state)
    expect(next.merge).toBeNull()
    expect(next.starred).toEqual(['A', 'C'])
  })

  it('keeps the row on a sent merge in View all until its direction arrives', () => {
    const sent: PrototypeSetState = {
      ...toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'),
      layout: 'set',
      mergeInto: { letter: 'D', from: ['A', 'C'] }
    }
    const update = vi.fn<Update>()
    renderSet3(sent, update)
    expect(screen.getByRole('button', { name: 'View all' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Processing merge')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(applied(update, sent).mergeInto).toBeNull()
  })

  it('lets View all and Design main switch the layout without ending a review under way', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    const review: PrototypeSetState = {
      ...stars,
      merge: {
        phase: 'review',
        letters: ['A', 'C'],
        parts: [
          {
            id: 0,
            name: 'Heading',
            kind: 'section',
            selectors: { A: 'main > h1', C: 'main > h1' },
            selector: 'main > h1',
            suggested: 'A',
            from: 'A',
            on: true
          }
        ],
        note: '',
        sending: false
      }
    }
    const update = vi.fn<Update>()
    renderSet3(review, update)
    fireEvent.click(screen.getByRole('button', { name: 'View all' }))
    const inSet = applied(update, review)
    expect(inSet).toMatchObject({ layout: 'set', merge: review.merge })
    cleanup()
    renderSet3(inSet, update)
    fireEvent.click(screen.getByRole('button', { name: 'Design main' }))
    expect(applied(update, inSet)).toMatchObject({ layout: 'focus', merge: review.merge })
  })

  it('shows the send-failure line when the chat refused the request', () => {
    renderSet3({ ...createSetState(['A', 'B', 'C']), mergeSendFailed: true })
    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't send: the chat is no longer active. Your draft is kept."
    )
  })
})

describe('PrototypeViewer panels during a merge', () => {
  beforeEach(() => {
    usePrototypeViewStore.setState({ listPanelHidden: false, sidePanelHidden: false })
  })
  afterEach(cleanup)

  function waitingState(): PrototypeSetState {
    return {
      ...toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'),
      merge: { phase: 'waiting', letters: ['A', 'C'], planId: 'p', baseline: null }
    }
  }

  it('offers no Hide list toggle outside a merge', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.queryByRole('button', { name: 'Hide list' })).toBeNull()
  })

  it('offers a Hide list toggle during a merge, and flips the list flag from it', () => {
    renderSet3(waitingState())
    fireEvent.click(screen.getByRole('button', { name: 'Hide list' }))
    expect(usePrototypeViewStore.getState().listPanelHidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument()
  })

  it('shows the draft panel toggle as hidden and disabled during a merge, and keeps the preference', () => {
    renderSet3(waitingState())
    expect(screen.getByRole('button', { name: 'Show panel' })).toBeDisabled()
    expect(usePrototypeViewStore.getState().sidePanelHidden).toBe(false)
  })
})

describe('PrototypeViewer toolbar structure', () => {
  afterEach(cleanup)

  it('keeps every control group in one container next to the title block', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    const controls = screen.getByRole('toolbar')
    expect(within(controls).getByRole('button', { name: 'Merge' })).toBeInTheDocument()
    for (const name of ['Layout', 'Viewport', 'Tool']) {
      expect(within(controls).getByRole('group', { name })).toBeInTheDocument()
    }
    expect(within(controls).getByRole('button', { name: 'Hide panel' })).toBeInTheDocument()
    const header = controls.parentElement
    expect(header?.children).toHaveLength(2)
    expect(header?.children[1]).toBe(controls)
    expect(controls).toHaveClass('flex-wrap')
    expect(controls).not.toHaveClass('overflow-x-auto')
  })

  it('puts the panel toggle right after the Browse / Annotate group', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    const tool = screen.getByRole('group', { name: 'Tool' })
    expect(tool.nextElementSibling).toBe(screen.getByRole('button', { name: 'Hide panel' }))
    // One flex item, so the toggle never separates from the group when the controls wrap.
    expect(tool.parentElement).toBe(
      screen.getByRole('button', { name: 'Hide panel' }).parentElement
    )
    expect(tool.parentElement).not.toBe(screen.getByRole('toolbar'))
  })
})

describe('PrototypeViewer icon-only controls', () => {
  afterEach(cleanup)

  it('shows the controls as icons, with the Merge label and count only at two stars', () => {
    renderSet3(toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'))
    const controls = screen.getByRole('toolbar')
    for (const text of [
      'View all',
      'Design main',
      'Desktop view',
      'Phone view',
      'Browse',
      'Annotate'
    ]) {
      expect(within(controls).queryByText(text)).toBeNull()
    }
    expect(within(controls).getByRole('button', { name: 'Merge (2)' }).textContent).toBe('Merge2')
  })

  it('names each icon and marks the selected layout, viewport and tool', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.getByRole('button', { name: 'Design main' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'View all' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Desktop view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Phone view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Annotate' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Browse' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the name of each icon in a tooltip on focus', async () => {
    renderSet3(toggleStar(createSetState(['A', 'B', 'C']), 'A'))
    for (const name of [
      'Merge',
      'View all',
      'Design main',
      'Desktop view',
      'Phone view',
      'Browse',
      'Annotate',
      'Hide panel'
    ]) {
      const control = screen.getByRole('button', { name })
      fireEvent.focus(control)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(name)
      fireEvent.blur(control)
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    }
  })

  it('shows the name of an icon in a tooltip on hover', async () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    fireEvent.pointerMove(screen.getByRole('button', { name: 'Annotate' }), {
      pointerType: 'mouse'
    })
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Annotate')
  })

  it('truncates the title with an ellipsis beside the controls', () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    expect(screen.getByText(/· 3 directions$/)).toHaveClass('truncate')
  })

  it('names the full title in a tooltip on hover', async () => {
    renderSet3(createSetState(['A', 'B', 'C']))
    fireEvent.pointerMove(screen.getByText(/· 3 directions$/), { pointerType: 'mouse' })
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Checkout$/u)
  })
})

describe('PrototypeViewer origin link', () => {
  afterEach(() => {
    cleanup()
    useAppStore.setState({ unifiedTabsByWorktree: {} })
  })

  it('names the parent chat from this client and opens it on click', () => {
    useAppStore.setState({
      unifiedTabsByWorktree: { 'wt-1': [parentTab('wt-1', 'parent-1', 'nexuscare-planning')] }
    })
    renderSet3(createSetState(['A', 'B', 'C']), vi.fn(), {
      set: { ...SET3, origin: { sessionId: 'parent-1' } }
    })
    fireEvent.click(screen.getByRole('button', { name: 'from “nexuscare-planning” ↗' }))
    expect(activateAndRevealWorktree).toHaveBeenCalledWith('wt-1')
    expect(activateStructuredAgentSessionById).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      sessionId: 'parent-1'
    })
  })

  it('shows a fallback chip, disabled, when this client holds no tab for the parent chat', () => {
    renderSet3(createSetState(['A', 'B', 'C']), vi.fn(), {
      set: { ...SET3, origin: { sessionId: 'parent-1' } }
    })
    expect(screen.getByRole('button', { name: 'from parent chat' })).toBeDisabled()
  })

  it('keeps the chip through a sent merge and a change of layout', () => {
    useAppStore.setState({
      unifiedTabsByWorktree: { 'wt-1': [parentTab('wt-1', 'parent-1', 'nexuscare-planning')] }
    })
    const sent: PrototypeSetState = {
      ...toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C'),
      layout: 'set',
      mergeInto: { letter: 'D', from: ['A', 'C'] }
    }
    const update = vi.fn<Update>()
    renderSet3(sent, update, { set: { ...SET3, origin: { sessionId: 'parent-1' } } })
    fireEvent.click(screen.getByRole('button', { name: 'Design main' }))
    expect(applied(update, sent)).toMatchObject({ mergeInto: { letter: 'D', from: ['A', 'C'] } })
    fireEvent.click(screen.getByRole('button', { name: 'from “nexuscare-planning” ↗' }))
    expect(activateStructuredAgentSessionById).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      sessionId: 'parent-1'
    })
  })

  it('opens the set chat in its own worktree', () => {
    renderSet3(createSetState(['A', 'B', 'C']), vi.fn(), {
      set: { ...SET3, worktreeId: 'wt-2', sessionId: 'child-1' }
    })
    fireEvent.click(screen.getByRole('button', { name: /open chat/u }))
    expect(activateAndRevealWorktree).toHaveBeenCalledWith('wt-2')
    expect(activateStructuredAgentSessionById).toHaveBeenCalledWith({
      worktreeId: 'wt-2',
      sessionId: 'child-1'
    })
  })
})

function parentTab(worktreeId: string, entityId: string, label: string): Tab {
  // SAFETY: the origin lookup reads only these fields; the rest of Tab is not used by it.
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the origin lookup reads only the fields set here.
  return {
    id: `tab-${entityId}`,
    worktreeId,
    entityId,
    contentType: 'agent-session',
    label,
    customLabel: null
  } as unknown as Tab
}
