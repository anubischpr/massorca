// @vitest-environment happy-dom

import type React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { OneLineSessionMenu } from './worktree-card-one-line-session-menu'

type ContentProps = { onCloseAutoFocus?: (event: { preventDefault: () => void }) => void }
const menu = vi.hoisted(() => ({ content: null as ContentProps | null }))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => children,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
  ContextMenuContent: (props: ContentProps & { children: React.ReactNode }) => {
    menu.content = props
    return <div>{props.children}</div>
  },
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

function chatRow(): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the menu reads only these fields.
  return {
    paneKey: 'structured-agent-session-s1:s1',
    tab: { id: 'structured-agent-session-s1', worktreeId: 'wt-vps' },
    agentType: 'claude',
    entry: { paneKey: 'p' }
  } as unknown as DashboardAgentRow
}

function renderMenu(onStartRename: () => void): NonNullable<ContentProps['onCloseAutoFocus']> {
  render(
    <OneLineSessionMenu agent={chatRow()} title="Pendientes" onStartRename={onStartRename}>
      <div>row</div>
    </OneLineSessionMenu>
  )
  return (event) => menu.content?.onCloseAutoFocus?.(event)
}

afterEach(() => {
  cleanup()
  menu.content = null
})

describe('renaming a session from its right-click menu', () => {
  it('opens the name field only after the closing menu gives up restoring focus', () => {
    const onStartRename = vi.fn()
    const closeAutoFocus = renderMenu(onStartRename)

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    // Why: a field opened on select is blurred when the closing menu restores focus, which ends the edit.
    expect(onStartRename).not.toHaveBeenCalled()

    const preventDefault = vi.fn()
    closeAutoFocus({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onStartRename).toHaveBeenCalledTimes(1)

    closeAutoFocus({ preventDefault })
    expect(onStartRename).toHaveBeenCalledTimes(1)
  })

  it('leaves focus restore alone when the menu closes for anything else', () => {
    const onStartRename = vi.fn()
    const closeAutoFocus = renderMenu(onStartRename)

    const preventDefault = vi.fn()
    closeAutoFocus({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(onStartRename).not.toHaveBeenCalled()
  })
})
