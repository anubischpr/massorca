// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { Repo } from '../../../../shared/repo-types'
import type * as RepositoryGitHubAccountModule from '../settings/repository-github-account'
import { MarketplaceGitHubProjects } from './MarketplaceGitHubProjects'

const { listAccountsMock, storeState } = vi.hoisted(() => ({
  listAccountsMock: vi.fn(),
  storeState: {
    settings: null as unknown,
    repos: [] as Repo[],
    settingsSearchQuery: '',
    updateRepo: vi.fn()
  }
}))

vi.mock('@/store', () => {
  const useAppStore = (selector: (state: typeof storeState) => unknown) => selector(storeState)
  useAppStore.getState = () => storeState
  return { useAppStore }
})

vi.mock('@/lib/repo-runtime-owner', () => ({
  getRepoOwnerRoutedSettings: (settings: unknown) => settings
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' }),
  callRuntimeRpc: vi.fn()
}))

vi.mock('../settings/repository-github-account', async (importOriginal) => ({
  ...(await importOriginal<typeof RepositoryGitHubAccountModule>()),
  listRepositoryGhBindableAccounts: listAccountsMock,
  validateRepositoryGhAccountBinding: vi.fn(),
  applyRepositoryGhAccountGitConfig: vi.fn(async () => ({ ok: true, identity: 'not_requested' })),
  readRepositoryGhAccountGitConfig: vi.fn(async () => ({ account: null, identityManaged: false }))
}))

// Why: Radix Select needs pointer/layout APIs happy-dom lacks; a native select keeps value + disabled testable.
vi.mock('../ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children
  }: {
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    disabled,
    children
  }: {
    value: string
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
}))

function githubRepo(id: string, displayName: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/home/user/${displayName}`,
    displayName,
    badgeColor: '#000000',
    addedAt: 0,
    kind: 'git',
    gitRemoteIdentity: {
      canonicalKey: `github.com/acme/${displayName}`,
      remoteName: 'origin',
      remoteUrl: `git@github.com:acme/${displayName}.git`
    },
    ...overrides
  }
}

const PLAIN_GITHUB = githubRepo('repo-plain', 'massorca')
const PINNED_GITHUB = githubRepo('repo-pinned', 'notes', {
  ghAccount: { host: 'github.com', user: 'work' }
})
const FOLDER = githubRepo('folder-1', 'scratch-folder', { kind: 'folder' })
const GITLAB: Repo = {
  id: 'repo-gitlab',
  path: '/home/user/gitlab-tools',
  displayName: 'gitlab-tools',
  badgeColor: '#000000',
  addedAt: 0,
  kind: 'git',
  gitRemoteIdentity: {
    canonicalKey: 'gitlab.com/acme/gitlab-tools',
    remoteName: 'origin',
    remoteUrl: 'git@gitlab.com:acme/gitlab-tools.git'
  }
}

const INVENTORY: GhAccountBindingInventory = {
  capability: 'supported',
  accounts: [
    {
      host: 'github.com',
      user: 'work',
      active: true,
      envToken: null,
      source: 'keyring',
      scopes: []
    }
  ]
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  listAccountsMock.mockReset()
  listAccountsMock.mockResolvedValue(INVENTORY)
  storeState.updateRepo.mockReset()
  storeState.updateRepo.mockResolvedValue(true)
  storeState.repos = [PLAIN_GITHUB, PINNED_GITHUB, FOLDER, GITLAB]
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

async function renderProjects(): Promise<void> {
  await act(async () => {
    root.render(<MarketplaceGitHubProjects />)
  })
  await act(async () => {})
}

function rowFor(name: string): HTMLLIElement {
  const row = [...container.querySelectorAll('li')].find((li) => li.textContent?.includes(name))
  if (!row) {
    throw new Error(`row for ${name} not found`)
  }
  return row
}

describe('MarketplaceGitHubProjects', () => {
  it('lists each GitHub project with its account select, and not folder or non-GitHub repos', async () => {
    await renderProjects()

    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(rowFor('massorca').querySelector('select')).not.toBeNull()
    expect(rowFor('notes').querySelector('select')).not.toBeNull()
    expect(container.textContent).not.toContain('scratch-folder')
    expect(container.textContent).not.toContain('gitlab-tools')
  })

  it('says whether each project follows the active account or uses its own', async () => {
    await renderProjects()

    expect(rowFor('massorca').textContent).toContain('Follows the active account')
    expect(rowFor('notes').textContent).toContain('Git uses this account')
    expect(rowFor('notes').textContent).not.toContain('Follows the active account')
  })

  it('shows the empty state when no project is on GitHub', async () => {
    storeState.repos = [FOLDER, GITLAB]

    await renderProjects()

    expect(container.querySelectorAll('li')).toHaveLength(0)
    expect(container.textContent).toContain('No GitHub projects')
  })
})
