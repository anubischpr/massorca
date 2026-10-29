// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { RepoInitGitResult } from '../../../../shared/rpc-contract/repo-init-git-params'
import NonGitFolderDialog from './NonGitFolderDialog'

const LOCAL_FOLDER_PATH = '/Users/dev/notes'

const mocks = vi.hoisted(() => {
  const modalData: Record<string, unknown> = {}
  const runtimeEnvironments: { id: string; name: string }[] = []
  const repos: Repo[] = []
  const worktreesByRepo: Record<string, unknown> = {}
  return {
    state: {
      activeModal: 'confirm-non-git-folder',
      modalData,
      closeModal: vi.fn(),
      addNonGitFolder: vi.fn(),
      fetchWorktrees: vi.fn(),
      runtimeEnvironments,
      repos,
      projects: [],
      projectHostSetups: [],
      worktreesByRepo,
      settings: { activeRuntimeEnvironmentId: null }
    },
    supportsGitInit: vi.fn(),
    initializeRuntimeRepoGit: vi.fn(),
    toastError: vi.fn()
  }
})

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    {
      getState: () => mocks.state,
      setState: (next: Partial<typeof mocks.state>) => {
        Object.assign(mocks.state, next)
      }
    }
  )
  return { useAppStore }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    variant
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => unknown
    variant?: string
  }) => (
    <button type="button" data-variant={variant ?? 'default'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError
  }
}))

vi.mock('@/runtime/runtime-repo-git-init-client', () => ({
  initializeRuntimeRepoGit: mocks.initializeRuntimeRepoGit,
  runtimeRepoSupportsGitInit: mocks.supportsGitInit
}))

function folderRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'folder-repo',
    path: LOCAL_FOLDER_PATH,
    displayName: 'notes',
    badgeColor: '#111',
    addedAt: 1,
    kind: 'folder',
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    ...overrides
  }
}

function footerButtons(): HTMLElement[] {
  return screen.getAllByRole('button')
}

function footerLabels(): string[] {
  return footerButtons().map((button) => button.textContent ?? '')
}

// Lets the capability promise settle so a negative answer is reflected in the footer.
async function settleHostCheck(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('NonGitFolderDialog Git initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.activeModal = 'confirm-non-git-folder'
    mocks.state.modalData = { folderPath: LOCAL_FOLDER_PATH }
    mocks.state.repos = []
    mocks.state.worktreesByRepo = {}
    mocks.state.fetchWorktrees.mockResolvedValue(true)
    mocks.supportsGitInit.mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
  })

  it('offers Cancel, Continue without Git, and Initialize Git here in that order', async () => {
    render(<NonGitFolderDialog />)

    await screen.findByRole('button', { name: 'Initialize Git here' })

    expect(footerLabels()).toEqual(['Cancel', 'Continue without Git', 'Initialize Git here'])
    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('data-variant')).toBe(
      'outline'
    )
    expect(
      screen.getByRole('button', { name: 'Continue without Git' }).getAttribute('data-variant')
    ).toBe('secondary')
    expect(
      screen.getByRole('button', { name: 'Initialize Git here' }).getAttribute('data-variant')
    ).toBe('default')
    expect(screen.getByText(/Initialize Git runs/)).toBeTruthy()
    expect(mocks.supportsGitInit).toHaveBeenCalledWith(
      mocks.state.settings,
      LOCAL_EXECUTION_HOST_ID
    )
  })

  it('hides Initialize Git and its note when a paired host lacks repo.init-git.v1', async () => {
    mocks.supportsGitInit.mockResolvedValue(false)
    mocks.state.modalData = { folderPath: '/srv/remote-notes', runtimeEnvironmentId: 'env-1' }

    render(<NonGitFolderDialog />)
    await waitFor(() =>
      expect(mocks.supportsGitInit).toHaveBeenCalledWith(
        mocks.state.settings,
        toRuntimeExecutionHostId('env-1')
      )
    )
    await settleHostCheck()

    expect(footerLabels()).toEqual(['Cancel', 'Continue without Git'])
    expect(screen.queryByText(/Initialize Git runs/)).toBeNull()
  })

  it('Cancel closes the dialog without adding anything', async () => {
    const user = userEvent.setup()
    render(<NonGitFolderDialog />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mocks.state.closeModal).toHaveBeenCalledTimes(1)
    expect(mocks.state.addNonGitFolder).not.toHaveBeenCalled()
    expect(mocks.initializeRuntimeRepoGit).not.toHaveBeenCalled()
  })

  it('Continue without Git adds the folder as a plain folder project', async () => {
    const user = userEvent.setup()
    mocks.state.addNonGitFolder.mockResolvedValue(folderRepo())
    render(<NonGitFolderDialog />)

    await user.click(await screen.findByRole('button', { name: 'Continue without Git' }))

    expect(mocks.state.addNonGitFolder).toHaveBeenCalledWith(LOCAL_FOLDER_PATH, {
      runtimeEnvironmentId: null
    })
    expect(mocks.state.closeModal).toHaveBeenCalledTimes(1)
    expect(mocks.initializeRuntimeRepoGit).not.toHaveBeenCalled()
  })

  it('Initialize Git here adds the folder, initializes Git on its host, and keeps it as a Git repo', async () => {
    const user = userEvent.setup()
    const added = folderRepo()
    mocks.state.repos = [added]
    mocks.state.addNonGitFolder.mockResolvedValue(added)
    mocks.initializeRuntimeRepoGit.mockResolvedValue({
      ok: true,
      repo: { ...added, kind: 'git' }
    })
    render(<NonGitFolderDialog />)

    await user.click(await screen.findByRole('button', { name: 'Initialize Git here' }))
    await waitFor(() => expect(mocks.state.closeModal).toHaveBeenCalledTimes(1))

    expect(mocks.state.addNonGitFolder).toHaveBeenCalledWith(LOCAL_FOLDER_PATH, {
      runtimeEnvironmentId: null
    })
    expect(mocks.initializeRuntimeRepoGit).toHaveBeenCalledWith(
      mocks.state.settings,
      added.id,
      LOCAL_EXECUTION_HOST_ID
    )
    expect(mocks.state.repos).toEqual([expect.objectContaining({ id: added.id, kind: 'git' })])
    expect(mocks.state.fetchWorktrees).toHaveBeenCalledWith(added.id, {
      requireAuthoritative: true,
      executionHostId: LOCAL_EXECUTION_HOST_ID
    })
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('keeps the folder project and reports the error when Git initialization fails', async () => {
    const user = userEvent.setup()
    const added = folderRepo()
    mocks.state.repos = [added]
    mocks.state.addNonGitFolder.mockResolvedValue(added)
    mocks.initializeRuntimeRepoGit.mockResolvedValue({
      ok: false,
      error: 'git_init_failed',
      message: 'fatal: cannot create .git'
    })
    render(<NonGitFolderDialog />)

    await user.click(await screen.findByRole('button', { name: 'Initialize Git here' }))
    await waitFor(() => expect(mocks.state.closeModal).toHaveBeenCalledTimes(1))

    expect(mocks.toastError).toHaveBeenCalledWith('Failed to initialize Git', {
      description: 'fatal: cannot create .git'
    })
    expect(mocks.state.repos).toEqual([added])
    expect(mocks.state.fetchWorktrees).not.toHaveBeenCalled()
  })

  it('does not initialize Git when the folder could not be added', async () => {
    const user = userEvent.setup()
    mocks.state.addNonGitFolder.mockResolvedValue(null)
    render(<NonGitFolderDialog />)

    await user.click(await screen.findByRole('button', { name: 'Initialize Git here' }))
    await waitFor(() => expect(mocks.state.closeModal).toHaveBeenCalledTimes(1))

    expect(mocks.initializeRuntimeRepoGit).not.toHaveBeenCalled()
  })

  it('disables every footer button until the add and Git initialization settle', async () => {
    const user = userEvent.setup()
    const added = folderRepo()
    mocks.state.repos = [added]
    mocks.state.addNonGitFolder.mockResolvedValue(added)
    const pending: { resolve?: (result: RepoInitGitResult) => void } = {}
    mocks.initializeRuntimeRepoGit.mockReturnValue(
      new Promise<RepoInitGitResult>((resolve) => {
        pending.resolve = resolve
      })
    )
    render(<NonGitFolderDialog />)

    await user.click(await screen.findByRole('button', { name: 'Initialize Git here' }))
    await waitFor(() => expect(mocks.initializeRuntimeRepoGit).toHaveBeenCalledTimes(1))

    for (const button of footerButtons()) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
    expect(mocks.state.closeModal).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve?.({ ok: true, repo: { ...added, kind: 'git' } })
    })
    await waitFor(() => expect(mocks.state.closeModal).toHaveBeenCalledTimes(1))
  })
})
