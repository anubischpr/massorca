// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { FloatingTerminalEmptyState } from './FloatingTerminalEmptyState'

const NO_SHORTCUT = { keys: [], doubleTap: false }
const CHECKLIST_SHORTCUT = { keys: ['Ctrl', 'Shift', 'H'], doubleTap: false }
const OPEN_SESSION_SHORTCUT = { keys: ['Ctrl', 'Shift', 'Y'], doubleTap: false }

function renderEmptyState(overrides: {
  onNewChecklist?: () => void
  onOpenSession?: () => void
  newChecklistShortcut?: ShortcutKeyComboDetails
  openSessionShortcut?: ShortcutKeyComboDetails
}) {
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
      newChecklistShortcut={overrides.newChecklistShortcut ?? NO_SHORTCUT}
      openSessionShortcut={overrides.openSessionShortcut ?? NO_SHORTCUT}
      closeShortcut={NO_SHORTCUT}
    />
  )
}

function rowText(label: string): string | null | undefined {
  return screen.getByText(label).closest('button')?.textContent
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

  it('shows each new chord beside its row', () => {
    renderEmptyState({
      newChecklistShortcut: CHECKLIST_SHORTCUT,
      openSessionShortcut: OPEN_SESSION_SHORTCUT
    })
    expect(rowText('Checklist')).toBe('ChecklistCtrl+Shift+H')
    expect(rowText('Open a session...')).toBe('Open a session...Ctrl+Shift+Y')
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
