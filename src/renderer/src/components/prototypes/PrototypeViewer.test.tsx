// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualPickedElement
} from '../../../../shared/native-chat-visual-annotate'
import {
  createSetState,
  pickElement,
  pinKeyFor,
  setNote,
  setPrompt,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeViewer } from './PrototypeViewer'
import { usePrototypeViewStore } from './prototype-view-store'

const frame = vi.hoisted(() => ({
  onAnnotateEvent: null as ((event: NativeChatVisualAnnotateEvent) => void) | null
}))

vi.mock('@/i18n/i18n', () => ({
  i18n: {},
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionById: vi.fn()
}))

vi.mock('./use-prototype-file-html', () => ({ usePrototypeFileHtml: () => null }))

vi.mock('./PrototypeThumbnail', () => ({ PrototypeThumbnail: () => null }))

vi.mock('./PrototypeFrame', () => ({
  PrototypeFrame: (props: { onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void }) => {
    frame.onAnnotateEvent = props.onAnnotateEvent
    return null
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
    />
  )
}

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
