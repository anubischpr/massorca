import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'

const mocks = vi.hoisted(() => ({
  closeUnifiedTab: vi.fn(),
  closeTerminalTab: vi.fn(),
  unifiedTabsByWorktree: {} as Record<string, Partial<Tab>[]>
}))

vi.mock('../../store', () => ({
  useAppStore: {
    getState: () => ({
      closeUnifiedTab: mocks.closeUnifiedTab,
      closeFile: vi.fn(),
      openFiles: [],
      unifiedTabsByWorktree: mocks.unifiedTabsByWorktree
    })
  }
}))
vi.mock('../terminal/terminal-tab-actions', () => ({ closeTerminalTab: mocks.closeTerminalTab }))
vi.mock('../editor/editor-autosave', () => ({ requestEditorFileClose: vi.fn() }))
vi.mock('@/lib/workspace-browser-tab-close', () => ({ closeWorkspaceBrowserTab: vi.fn() }))

import { createWorkspaceTabCloseCommands } from './workspace-tab-close-commands'

function sessionTab(sessionRef: NonNullable<Tab['sessionRef']>): Tab {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: closeItem reads only these fields of the tab.
  return {
    id: 'floating-ref',
    entityId: sessionRef.tabId,
    contentType: 'session-ref',
    sessionRef
  } as Tab
}

describe('closing a floating tab that shows a host terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.unifiedTabsByWorktree['vps'] = [
      { id: 'host-term', entityId: 'host-term-row', contentType: 'terminal', viewMode: 'terminal' }
    ]
  })

  it('ends the terminal the floating panel started', () => {
    const tab = sessionTab({ worktreeId: 'vps', tabId: 'host-term', endsSessionOnClose: true })
    createWorkspaceTabCloseCommands({ worktreeId: 'floating', groupTabs: [tab] }).closeItem(tab.id)
    expect(mocks.closeUnifiedTab).toHaveBeenCalledWith('floating-ref')
    expect(mocks.closeTerminalTab).toHaveBeenCalledWith('host-term-row', {})
  })

  it('gives an opened session back to its workspace', () => {
    const tab = sessionTab({ worktreeId: 'vps', tabId: 'host-term' })
    createWorkspaceTabCloseCommands({ worktreeId: 'floating', groupTabs: [tab] }).closeItem(tab.id)
    expect(mocks.closeUnifiedTab).toHaveBeenCalledWith('floating-ref')
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })
})
