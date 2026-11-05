// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { CLOSE_ALL_CONTEXT_MENUS_EVENT } from '@/lib/close-all-context-menus'
import { OneLineSessionMenu } from './worktree-card-one-line-session-menu'

function chatRow(): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the menu reads only these fields.
  return {
    paneKey: 'structured-agent-session-s1:s1',
    tab: { id: 'structured-agent-session-s1', worktreeId: 'wt-vps' },
    agentType: 'claude',
    entry: { paneKey: 'p' }
  } as unknown as DashboardAgentRow
}

function openSessionMenu(): void {
  render(
    <>
      <button type="button">older menu trigger</button>
      <OneLineSessionMenu agent={chatRow()} title="Pendientes" onStartRename={() => undefined}>
        <div>session row</div>
      </OneLineSessionMenu>
    </>
  )
  fireEvent.contextMenu(screen.getByText('session row'))
}

afterEach(cleanup)

describe('the session menu as the newest menu', () => {
  it('closes older menus when it opens and stays open when one hands focus back', () => {
    const onCloseAll = vi.fn()
    window.addEventListener(CLOSE_ALL_CONTEXT_MENUS_EVENT, onCloseAll)
    openSessionMenu()
    window.removeEventListener(CLOSE_ALL_CONTEXT_MENUS_EVENT, onCloseAll)
    expect(onCloseAll).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('menu')).toBeTruthy()

    // Why: a closing older menu restores focus to its own trigger, which dismissed this one.
    act(() => {
      screen.getByText('older menu trigger').focus()
    })
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('closes when a newer menu opens', () => {
    openSessionMenu()
    act(() => {
      window.dispatchEvent(new Event(CLOSE_ALL_CONTEXT_MENUS_EVENT))
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
