import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeCardProperty } from '../../../../shared/ui-chrome-types'
import type { Worktree } from '../../../../shared/worktree/types'

const fetchHostedReviewForBranch = vi.fn()
const fetchIssue = vi.fn()
const fetchLinearIssue = vi.fn()
const openModal = vi.fn()
const updateWorktreeMeta = vi.fn()

let worktreeCardProperties: WorktreeCardProperty[] = ['status', 'pr', 'inline-agents']
let settings: Partial<GlobalSettings> | null = null
// Why: the first import of the whole card graph is slow on a cold transform cache.
const WORKTREE_CARD_IMPORT_TIMEOUT_MS = 120_000

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      deleteStateByWorktreeId: {},
      fetchHostedReviewForBranch,
      fetchIssue,
      fetchLinearIssue,
      gitConflictOperationByWorktree: {},
      hostedReviewCache: {},
      issueCache: {},
      linearIssueCache: {},
      openModal,
      projectGroups: [],
      remoteBranchConflictByWorktreeId: {},
      settings,
      sshConnectionStates: new Map(),
      sshTargetLabels: new Map(),
      updateWorktreeMeta,
      workspacePortScan: null,
      worktreeCardProperties
    })
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('./use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'idle'
}))

vi.mock('./use-worktree-sleep-state', () => ({
  useIsSleepingWorktree: () => false
}))

vi.mock('./CacheTimer', () => ({
  default: () => null,
  usePromptCacheCountdownStartedAt: () => null
}))

vi.mock('./useWorktreeAgentRows', () => ({
  useWorktreeAgentRows: () => []
}))

vi.mock('./WorktreeCardAgents', () => ({
  default: () => null
}))

vi.mock('./WorktreeContextMenu', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
  WORKTREE_NATIVE_CONTEXT_MENU_ATTR: 'data-worktree-native-context-menu',
  WORKTREE_CONTEXT_MENU_SCOPE_ATTR: 'data-orca-context-menu-scope'
}))

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/repo',
    displayName: 'orca',
    badgeColor: '#999999',
    repoIcon: { type: 'emoji', emoji: '🦊' },
    addedAt: 1,
    ...overrides
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo-1::/repo/worktrees/host',
    repoId: 'repo-1',
    path: '/repo/worktrees/host',
    displayName: 'Host tree',
    branch: 'feature/host',
    head: 'abc123',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    ...overrides
  }
}

// Imported per test so the mocked store is seeded before the module reads it.
async function renderCardMarkup(
  props: {
    branchLabel?: string
    branchQualifier?: string
    sidebarRow?: boolean
    worktree?: Worktree
  } = {}
): Promise<string> {
  const { default: WorktreeCard } = await import('./WorktreeCard')
  return renderToStaticMarkup(
    <WorktreeCard
      worktree={props.worktree ?? makeWorktree()}
      repo={makeRepo()}
      isActive={false}
      sidebarRow={props.sidebarRow ?? true}
      branchLabel={props.branchLabel}
      branchQualifier={props.branchQualifier}
    />
  )
}

describe('WorktreeCard layout default', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    worktreeCardProperties = ['status', 'pr', 'inline-agents']
    settings = {}
  })

  it(
    'keeps the Detailed card on a surface that is not a sidebar row',
    async () => {
      const markup = await renderCardMarkup({ sidebarRow: false })

      expect(markup).not.toContain('data-worktree-card-branch-row')
      expect(markup).toContain('data-worktree-card-meta-row')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'renders the one-line branch row when no layout was ever chosen',
    async () => {
      const markup = await renderCardMarkup()

      expect(markup).toContain('data-worktree-card-branch-row')
      expect(markup).toContain('feature/host')
      expect(markup).not.toContain('data-worktree-card-meta-row')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'keeps the Detailed card for a persisted Detailed choice',
    async () => {
      settings = { compactWorktreeCards: false, worktreeCardLayout: 'detailed' }

      const markup = await renderCardMarkup()

      expect(markup).not.toContain('data-worktree-card-branch-row')
      expect(markup).toContain('Host tree')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'keeps Compact for a profile that switched it on before the layout setting existed',
    async () => {
      settings = { compactWorktreeCards: true }

      expect(await renderCardMarkup()).not.toContain('data-worktree-card-branch-row')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'keeps the experimental card style when it was switched on',
    async () => {
      settings = { experimentalNewWorktreeCardStyle: true }

      expect(await renderCardMarkup()).not.toContain('data-worktree-card-branch-row')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )
})

describe('WorktreeCard one-line branch row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    worktreeCardProperties = ['status', 'pr', 'inline-agents']
    settings = {}
  })

  it(
    'shows the label it was given instead of the full branch',
    async () => {
      const markup = await renderCardMarkup({ branchLabel: 'host' })

      expect(markup).toContain('>host<')
      expect(markup).not.toContain('feature/host')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'names the host or project only when the list says it is needed',
    async () => {
      expect(await renderCardMarkup()).not.toContain('gpu-vm')
      expect(await renderCardMarkup({ branchQualifier: 'gpu-vm' })).toContain('gpu-vm')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'shows the commit for a detached HEAD and no branch text',
    async () => {
      const markup = await renderCardMarkup({
        worktree: makeWorktree({ branch: '', head: 'abcdef1234567' })
      })

      expect(markup).toContain('abcdef1')
      expect(markup).not.toContain('Detached HEAD')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )
})
