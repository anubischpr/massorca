// @vitest-environment happy-dom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../../../shared/execution-host'
import type { Repo } from '../../../../../../shared/repo-types'
import { RepoHeaderTitle } from './RepoHeaderTitle'

const mocks = vi.hoisted(() => {
  const repos: Repo[] = []
  return {
    state: {
      repos,
      projects: [],
      projectHostSetups: [],
      fetchWorktrees: vi.fn(),
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

vi.mock('@/components/repo/use-repo-gh-account-display', () => ({
  useRepoGhAccountDisplay: () => ({ label: null, source: null, mismatch: false })
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
    path: '/Users/dev/notes',
    displayName: 'notes',
    badgeColor: '#111',
    addedAt: 1,
    kind: 'folder',
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    ...overrides
  }
}

function gitRepo(overrides: Partial<Repo> = {}): Repo {
  return folderRepo({ id: 'git-repo', kind: 'git', ...overrides })
}

function renderHeader(repo: Repo, onRowClick = vi.fn()) {
  const result = render(
    <div onClick={onRowClick}>
      <RepoHeaderTitle label={repo.displayName} repo={repo} />
    </div>
  )
  return {
    ...result,
    onRowClick,
    rerenderWith: (next: Repo) =>
      result.rerender(
        <div onClick={onRowClick}>
          <RepoHeaderTitle label={next.displayName} repo={next} />
        </div>
      )
  }
}

function noGitPill(): HTMLElement {
  return screen.getByRole('button', { name: 'No Git: show limitations' })
}

// Lets the capability promise settle so the footer reflects a negative answer.
async function settleHostCheck(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('RepoHeaderTitle folder project marker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.repos = [folderRepo()]
    mocks.state.fetchWorktrees.mockResolvedValue(true)
    mocks.supportsGitInit.mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the No Git pill only for folder projects', () => {
    renderHeader(folderRepo())
    expect(noGitPill().textContent).toBe('No Git')
    cleanup()

    renderHeader(gitRepo())
    expect(screen.queryByRole('button', { name: 'No Git: show limitations' })).toBeNull()
    expect(mocks.supportsGitInit).not.toHaveBeenCalled()
  })

  it('clicking the pill opens the popover without toggling the row', async () => {
    const user = userEvent.setup()
    const { onRowClick } = renderHeader(folderRepo())

    await user.click(noGitPill())

    expect(onRowClick).not.toHaveBeenCalled()
    expect(await screen.findByText('This project has no Git')).toBeTruthy()
    expect(screen.getByText('Editor, terminal, and search work. Not available:')).toBeTruthy()
    expect(screen.getByText('Isolated workspaces and branches')).toBeTruthy()
    expect(
      screen.getByText(
        'Child sessions in their own worktree — they would edit the same files as the parent chat'
      )
    ).toBeTruthy()
    expect(screen.getByText('Changes, diffs, and commits')).toBeTruthy()
    expect(screen.getByText('Pull requests and reviews')).toBeTruthy()
    expect(
      screen.getByText('Recommended only for exploring folders and non-development work.')
    ).toBeTruthy()
    expect(mocks.supportsGitInit).toHaveBeenCalledWith(
      mocks.state.settings,
      LOCAL_EXECUTION_HOST_ID
    )
  })

  it('clicks inside the popover do not reach the row', async () => {
    const user = userEvent.setup()
    const { onRowClick } = renderHeader(folderRepo())

    await user.click(noGitPill())
    await user.click(await screen.findByText('This project has no Git'))

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('hides Initialize Git when the host lacks the capability', async () => {
    const user = userEvent.setup()
    mocks.supportsGitInit.mockResolvedValue(false)
    renderHeader(folderRepo({ executionHostId: toRuntimeExecutionHostId('env-1') }))

    await user.click(noGitPill())
    await screen.findByText('This project has no Git')
    await settleHostCheck()

    expect(screen.queryByRole('button', { name: 'Initialize Git' })).toBeNull()
    expect(mocks.supportsGitInit).toHaveBeenCalledWith(
      mocks.state.settings,
      toRuntimeExecutionHostId('env-1')
    )
  })

  it('initializes Git, upserts the Git repo, refreshes worktrees, and closes', async () => {
    const user = userEvent.setup()
    const initialized = gitRepo({ id: 'folder-repo', displayName: 'notes' })
    mocks.initializeRuntimeRepoGit.mockResolvedValue({ ok: true, repo: initialized })
    const { rerenderWith } = renderHeader(folderRepo())

    await user.click(noGitPill())
    await user.click(await screen.findByRole('button', { name: 'Initialize Git' }))

    await waitFor(() => expect(screen.queryByText('This project has no Git')).toBeNull())
    expect(mocks.initializeRuntimeRepoGit).toHaveBeenCalledWith(
      mocks.state.settings,
      'folder-repo',
      LOCAL_EXECUTION_HOST_ID
    )
    expect(mocks.state.repos).toEqual([initialized])
    expect(mocks.state.fetchWorktrees).toHaveBeenCalledWith('folder-repo', {
      requireAuthoritative: true,
      executionHostId: LOCAL_EXECUTION_HOST_ID
    })
    expect(mocks.toastError).not.toHaveBeenCalled()

    rerenderWith(initialized)
    expect(screen.queryByRole('button', { name: 'No Git: show limitations' })).toBeNull()
  })

  it('keeps Initialize Git disabled while the init runs', async () => {
    const user = userEvent.setup()
    let resolveInit: (value: unknown) => void = () => {}
    mocks.initializeRuntimeRepoGit.mockReturnValue(
      new Promise((resolve) => {
        resolveInit = resolve
      })
    )
    renderHeader(folderRepo())

    await user.click(noGitPill())
    const button = await screen.findByRole('button', { name: 'Initialize Git' })
    await user.click(button)

    expect(screen.getByRole('button', { name: 'Initialize Git' }).hasAttribute('disabled')).toBe(
      true
    )
    await act(async () => {
      resolveInit({ ok: false, error: 'git_failed', message: 'nothing to commit' })
    })
  })

  it('toasts the typed refusal and keeps the folder project', async () => {
    const user = userEvent.setup()
    mocks.initializeRuntimeRepoGit.mockResolvedValue({
      ok: false,
      error: 'git_failed',
      message: 'git init refused'
    })
    renderHeader(folderRepo())

    await user.click(noGitPill())
    await user.click(await screen.findByRole('button', { name: 'Initialize Git' }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Failed to initialize Git', {
        description: 'git init refused'
      })
    )
    expect(mocks.state.repos).toEqual([folderRepo()])
    expect(mocks.state.fetchWorktrees).not.toHaveBeenCalled()
    expect(screen.getByText('This project has no Git')).toBeTruthy()
  })

  it('toasts a thrown init error', async () => {
    const user = userEvent.setup()
    mocks.initializeRuntimeRepoGit.mockRejectedValue(new Error('ipc closed'))
    renderHeader(folderRepo())

    await user.click(noGitPill())
    await user.click(await screen.findByRole('button', { name: 'Initialize Git' }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Failed to initialize Git', {
        description: 'ipc closed'
      })
    )
  })
})
