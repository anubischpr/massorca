// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FloatingTerminalEmptyState } from './FloatingTerminalEmptyState'

const NO_SHORTCUT = { keys: [], doubleTap: false }

function renderEmptyState(overrides: { onNewChecklist?: () => void; onOpenSession?: () => void }) {
  render(
    <FloatingTerminalEmptyState
      onNewTerminal={vi.fn()}
      onNewMarkdown={vi.fn()}
      onOpenMarkdown={vi.fn()}
      onNewBrowser={vi.fn()}
      showNewBrowser={true}
      onNewChecklist={overrides.onNewChecklist ?? vi.fn()}
      onOpenSession={overrides.onOpenSession ?? vi.fn()}
      onClose={vi.fn()}
      onFocusPanel={vi.fn()}
      newTerminalShortcut={NO_SHORTCUT}
      newBrowserShortcut={NO_SHORTCUT}
      newMarkdownShortcut={NO_SHORTCUT}
      openMarkdownShortcut={NO_SHORTCUT}
      closeShortcut={NO_SHORTCUT}
    />
  )
}

describe('the floating workspace start screen', () => {
  afterEach(cleanup)

  it('offers Checklist and Open a session... before Minimize', () => {
    renderEmptyState({})
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'New Terminal',
      'New Markdown Note',
      'Open Markdown Note',
      'New Browser',
      'Checklist',
      'Open a session...',
      'Minimize'
    ])
  })

  it('opens the Checklist tab and the session picker', () => {
    const onNewChecklist = vi.fn()
    const onOpenSession = vi.fn()
    renderEmptyState({ onNewChecklist, onOpenSession })
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open a session...' }))
    expect(onNewChecklist).toHaveBeenCalledTimes(1)
    expect(onOpenSession).toHaveBeenCalledTimes(1)
  })
})
