import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PendingWorktreeCreation,
  WorktreeCreationRequest
} from '@/lib/pending-worktree-creation'

const store = {
  activePendingCreationId: 'shown-creation' as string | null,
  pendingWorktreeCreations: {} as Record<string, PendingWorktreeCreation>,
  beginPendingWorktreeCreation: vi.fn(),
  setActivePendingWorktreeCreation: vi.fn(),
  setActiveView: vi.fn(),
  setSidebarOpen: vi.fn()
}

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('@/lib/browser-uuid', () => ({ createBrowserUuid: () => 'creation-new' }))
vi.mock('@/lib/worktree-creation-flow-execute', () => ({
  executeWorktreeCreation: vi.fn(async () => undefined)
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { runBackgroundWorktreeCreation } from './worktree-creation-flow'

const request: WorktreeCreationRequest = {
  repoId: 'repo-1',
  name: 'feature',
  setupDecision: 'run',
  agent: 'claude',
  pendingFirstAgentMessageRename: false,
  note: '',
  startupPlan: null,
  quickPrompt: 'Fix login',
  quickTelemetry: null
}

describe('runBackgroundWorktreeCreation reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.pendingWorktreeCreations = {}
  })

  it('reveals the creation surface in the main window by default', () => {
    runBackgroundWorktreeCreation(request)

    expect(store.beginPendingWorktreeCreation).toHaveBeenCalledOnce()
    expect(store.setActiveView).toHaveBeenCalledWith('terminal')
    expect(store.setSidebarOpen).toHaveBeenCalledWith(true)
    expect(store.setActivePendingWorktreeCreation).not.toHaveBeenCalled()
  })

  it('leaves the main window as it is when the caller does not reveal', () => {
    const creationId = runBackgroundWorktreeCreation(request, { revealCreationSurface: false })

    expect(creationId).toBe('creation-new')
    expect(store.beginPendingWorktreeCreation).toHaveBeenCalledOnce()
    expect(store.setActiveView).not.toHaveBeenCalled()
    expect(store.setSidebarOpen).not.toHaveBeenCalled()
    // Why: beginning a pending entry points the content panel at it; the previous one is restored.
    expect(store.setActivePendingWorktreeCreation).toHaveBeenCalledWith('shown-creation')
  })
})
