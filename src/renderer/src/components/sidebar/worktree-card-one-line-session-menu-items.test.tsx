// @vitest-environment happy-dom

import type React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { OneLineSessionMenu } from './worktree-card-one-line-session-menu'

const store = vi.hoisted(() => ({
  dropAgentStatus: vi.fn(),
  dismissRetainedAgent: vi.fn(),
  acknowledgeAgents: vi.fn(),
  worktreesByRepo: {}
}))

vi.mock('@/store', () => {
  const useAppStore = (selector: (state: typeof store) => unknown): unknown => selector(store)
  useAppStore.getState = () => store
  return { useAppStore }
})

vi.mock('../tab-group/session-split-view', () => ({
  canOpenSessionInSplitView: () => false,
  openSessionInSplitView: vi.fn()
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => children,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({
    onSelect,
    children
  }: {
    onSelect?: () => void
    children: React.ReactNode
  }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => null
}))

function row(rowSource?: DashboardAgentRow['rowSource']): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the menu reads only these fields.
  return {
    paneKey: 'tab-1:1',
    tab: { id: 'tab-1', worktreeId: 'wt-main' },
    agentType: 'claude',
    rowSource,
    entry: { paneKey: 'tab-1:1' }
  } as unknown as DashboardAgentRow
}

function renderMenu(agent: DashboardAgentRow, onStartRename?: () => void): void {
  render(
    <OneLineSessionMenu agent={agent} title="Informe" onStartRename={onStartRename}>
      <div>row</div>
    </OneLineSessionMenu>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the session menu items', () => {
  it('clears a retained session from the list, the way the row dismiss does', () => {
    renderMenu(row('retained'))

    fireEvent.click(screen.getByRole('button', { name: 'Clear from List' }))

    expect(store.dropAgentStatus).toHaveBeenCalledWith('tab-1:1')
    expect(store.dismissRetainedAgent).toHaveBeenCalledWith('tab-1:1')
  })

  it('closes a session that owns a tab and offers no list clearing', () => {
    renderMenu(row(), () => undefined)

    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear from List' })).toBeNull()
  })

  it('hides Rename on a row without an inline name field', () => {
    renderMenu(row())

    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
