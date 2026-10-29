// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualPickedElement
} from '../../../../shared/native-chat-visual-annotate'
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

vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionById: vi.fn()
}))

vi.mock('./use-prototype-file-html', () => ({ usePrototypeFileHtml: () => null }))

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
    expect(screen.getByRole('button', { name: 'Merge (1)' })).toBeDisabled()
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

  it('leaves the main area blank, with no frame, banner or text, and keeps the strip', () => {
    const stars = toggleStar(toggleStar(createSetState(['A', 'B', 'C']), 'A'), 'C')
    renderSet3({
      ...stars,
      merge: { phase: 'waiting', letters: ['A', 'C'], planId: 'p', baseline: null }
    })
    expect(screen.queryByTestId('frame')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/click any element/u)).toBeNull()
    expect(screen.getByRole('group', { name: 'Directions in this set' })).toBeInTheDocument()
  })

  it('shows the send-failure line when the chat refused the request', () => {
    renderSet3({ ...createSetState(['A', 'B', 'C']), mergeSendFailed: true })
    expect(screen.getByRole('alert').textContent).toBe(
      "Couldn't send: the chat is no longer active. Your draft is kept."
    )
  })
})
