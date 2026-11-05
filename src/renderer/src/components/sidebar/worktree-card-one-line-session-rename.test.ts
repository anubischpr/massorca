import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import { renameOneLineSession } from './worktree-card-one-line-session-rename'

const store = vi.hoisted(() => ({
  unifiedTabsByWorktree: {} as Record<string, Tab[]>,
  setTabCustomLabel: vi.fn(),
  setTabCustomTitle: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))

function chatTab(id: string, worktreeId: string): Tab {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the index reads only these fields.
  return { id, entityId: 'session-1', worktreeId, contentType: 'agent-session' } as Tab
}

describe('renaming a session from the one-line sidebar', () => {
  beforeEach(() => {
    store.setTabCustomLabel.mockReset()
    store.setTabCustomTitle.mockReset()
    store.unifiedTabsByWorktree = {}
  })

  it('names a chat session through its chat tab label, which the row and host snapshots keep', () => {
    const tabId = 'structured-agent-session-claude_a020924f'
    store.unifiedTabsByWorktree = { 'wt-vps': [chatTab(tabId, 'wt-vps')] }

    renameOneLineSession({ id: tabId, worktreeId: 'wt-vps' }, 'Pendientes NexusCare')

    expect(store.setTabCustomLabel).toHaveBeenCalledWith(tabId, 'Pendientes NexusCare')
    expect(store.setTabCustomTitle).not.toHaveBeenCalled()
  })

  it('still names a terminal session through its tab title', () => {
    renameOneLineSession({ id: 'tab-1', worktreeId: 'wt-1' }, 'Build')

    expect(store.setTabCustomTitle).toHaveBeenCalledWith('tab-1', 'Build')
    expect(store.setTabCustomLabel).not.toHaveBeenCalled()
  })
})
