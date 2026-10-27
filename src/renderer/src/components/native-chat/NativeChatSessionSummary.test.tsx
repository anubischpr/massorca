// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AgentChildRowContext } from '../../../../shared/agent-child-row-model'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { StructuredAgentContextSummary } from '../../../../shared/structured-agent-session-context-usage'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearRepoGhAccountGitConfigCache } from '@/lib/repo-gh-account-git-config-cache'
import { NativeChatSessionSummary } from './NativeChatSessionSummary'
import { NativeChatVisualOwnerContext } from './native-chat-visual-owner'

const { store, readGitConfig } = vi.hoisted(() => {
  const repos: unknown[] = []
  const settings: unknown = { activeRuntimeEnvironmentId: null }
  const worktreesByRepo: Record<string, unknown[]> = {}
  const openRightSidebarVisual: (route: unknown) => void = () => {}
  return {
    store: { repos, settings, worktreesByRepo, openRightSidebarVisual },
    readGitConfig: vi.fn<() => Promise<unknown>>(async () => null)
  }
})
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector(store)
}))
vi.mock('@/components/settings/repository-github-account', () => ({
  readRepositoryGhAccountGitConfig: readGitConfig
}))
vi.mock('@/lib/repo-slug-index', () => ({
  useRepoSlugIndex: () => ({ ready: true })
}))
vi.mock('./use-structured-agent-session-host-label', () => ({
  useStructuredAgentSessionHostLabel: () => 'Development VPS'
}))
vi.mock('./NativeChatSessionServers', () => ({
  NativeChatSessionServers: () => <div>QA servers</div>
}))
vi.mock('./NativeChatCodexBackgroundPanel', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  NativeChatCodexBackgroundPanel: () => null
}))
afterEach(() => {
  cleanup()
  store.repos = []
  store.worktreesByRepo = {}
  clearRepoGhAccountGitConfigCache()
  readGitConfig.mockReset()
  readGitConfig.mockResolvedValue(null)
})

const connectorCall: AgentJournalRenderItem = {
  itemId: 'call',
  sequence: 1,
  revision: 1,
  observedAt: 10,
  body: {
    kind: 'tool-call',
    name: 'mcp__history__search',
    input: {},
    state: 'completed'
  }
}
const todoPlan: AgentJournalRenderItem = {
  itemId: 'todo',
  sequence: 2,
  revision: 1,
  observedAt: 20,
  body: {
    kind: 'tool-call',
    name: 'TodoWrite',
    input: {
      todos: [
        { content: 'Read the spec', status: 'completed' },
        {
          content: 'Write the fix',
          status: 'in_progress',
          activeForm: 'Writing the fix'
        },
        { content: 'Run tests', status: 'pending' }
      ]
    },
    state: 'completed'
  }
}
const props = {
  target: { kind: 'environment', environmentId: 'opaque-id' } as const,
  fileContext: null,
  contextSummary: null,
  roster: undefined,
  isVisible: true,
  onLinkClick: undefined,
  journalItems: [connectorCall]
}

it('keeps historical success separate from unknown current connector status', () => {
  render(<NativeChatSessionSummary {...props} />)
  expect(screen.getByText('Development VPS')).toBeTruthy()
  expect(screen.queryByText('opaque-id')).toBeNull()
  expect(
    screen.getByText('Current connector status is not reported by this provider or host.')
  ).toBeTruthy()
  expect(screen.queryByText(/connected/i)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Connectors/ }))
  expect(screen.getByText('Recorded calls (historical)')).toBeTruthy()
  expect(screen.getByText('completed')).toBeTruthy()
})

it('shows humanized connector names with their status and the raw key on hover', () => {
  const connectorSnapshot = {
    observedAt: 10,
    servers: [
      { name: 'docs', status: 'connected' as const },
      { name: 'openmetadata-escritura', status: 'failed' as const }
    ]
  }
  const { rerender } = render(
    <NativeChatSessionSummary {...props} connectorSnapshot={connectorSnapshot} />
  )
  expect(screen.getByText('Docs · Connected')).toBeTruthy()
  expect(screen.getByText('Openmetadata escritura · Failed')).toBeTruthy()
  expect(screen.getByTitle('openmetadata-escritura')).toBeTruthy()
  expect(screen.getByText(/Provider status at/)).toBeTruthy()
  rerender(
    <NativeChatSessionSummary
      {...props}
      connectorSnapshot={connectorSnapshot}
      context={{
        parentEvidenceFresh: false,
        transportObservation: 'unverifiable',
        parentObservedAt: 10,
        hostClockOffsetMs: 0
      }}
    />
  )
  expect(screen.queryByText('Docs · Connected')).toBeNull()
  expect(
    screen.getByText('Current connector status is not reported by this provider or host.')
  ).toBeTruthy()
})

it('distinguishes a confirmed empty connector inventory from unavailable data', () => {
  render(
    <NativeChatSessionSummary {...props} connectorSnapshot={{ observedAt: 10, servers: [] }} />
  )
  expect(
    screen.queryByText('Current connector status is not reported by this provider or host.')
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Subagents/ }))
  expect(
    screen.getByText('Subagent information is not reported by this provider or host.')
  ).toBeTruthy()
})

it('uses bounded context percentages in the compact card and expanded token detail', () => {
  const contextSummary: StructuredAgentContextSummary = {
    usedTokens: 27_539,
    windowTokens: 1_000_000,
    percentage: 2.7539000000000002,
    estimated: false,
    categories: [],
    observedAt: 10
  }
  render(<NativeChatSessionSummary {...props} contextSummary={contextSummary} />)
  expect(screen.getByText('2.8%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Context/ }))
  expect(screen.getByText(/27,?539 tokens/)).toBeTruthy()
  expect(screen.getByText(/1,?000,?000 tokens/)).toBeTruthy()
  expect(screen.queryByText(/2\.7539000000000002/)).toBeNull()
})

it('shows used tokens without a percentage when the window is not known', () => {
  const contextSummary: StructuredAgentContextSummary = {
    usedTokens: 18_600,
    windowTokens: null,
    percentage: null,
    estimated: true,
    categories: [],
    observedAt: 10
  }
  render(<NativeChatSessionSummary {...props} contextSummary={contextSummary} />)
  expect(screen.getByText('~18.6k tokens')).toBeTruthy()
  expect(screen.queryByText(/%/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Context/ }))
  expect(screen.getByText('Not reported by the provider.')).toBeTruthy()
  expect(screen.getByText(/Estimated from the last provider response/)).toBeTruthy()
})

it('shows plan progress and the current item, then the full checklist inline', () => {
  render(<NativeChatSessionSummary {...props} journalItems={[todoPlan]} />)
  const plan = screen.getByRole('button', { name: /^Plan/ })
  expect(plan.textContent).toContain('1 of 3')
  expect(screen.getByText('Writing the fix')).toBeTruthy()
  fireEvent.click(plan)
  expect(screen.getByText('Read the spec').className).toContain('line-through')
  expect(screen.getByText('Run tests').className).not.toContain('line-through')
})

it('says so when the provider reported no plan', () => {
  render(<NativeChatSessionSummary {...props} />)
  expect(screen.getByText('No plan reported')).toBeTruthy()
})

it('expands sections inline, several at once, and collapses each without a back action', () => {
  render(
    <NativeChatSessionSummary
      {...props}
      contextSummary={{
        usedTokens: 1_000,
        windowTokens: 10_000,
        percentage: 10,
        estimated: false,
        categories: [],
        observedAt: 10
      }}
    />
  )
  const context = screen.getByRole('button', { name: /Context/ })
  const connectors = screen.getByRole('button', { name: /Connectors/ })
  expect(context.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(context)
  fireEvent.click(connectors)
  expect(context.getAttribute('aria-expanded')).toBe('true')
  expect(connectors.getAttribute('aria-expanded')).toBe('true')
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  fireEvent.click(context)
  expect(context.getAttribute('aria-expanded')).toBe('false')
  expect(connectors.getAttribute('aria-expanded')).toBe('true')
})

it('shows the project and branch compactly and every workspace field when expanded', () => {
  store.repos = [
    {
      id: 'repo',
      path: 'C:/repos/orca',
      displayName: 'Orca',
      badgeColor: '#000',
      addedAt: 0
    }
  ]
  store.worktreesByRepo = {
    repo: [
      {
        id: 'repo::C:/repos/orca/feature-wt',
        repoId: 'repo',
        path: 'C:/repos/orca/feature-wt',
        branch: 'refs/heads/feature/x',
        displayName: 'Feature worktree'
      }
    ]
  }
  render(
    <NativeChatSessionSummary
      {...props}
      fileContext={{
        worktreeId: 'repo::C:/repos/orca/feature-wt',
        worktreePath: 'C:/repos/orca/feature-wt',
        runtimeEnvironmentId: null
      }}
    />
  )
  expect(screen.getByText('Orca')).toBeTruthy()
  expect(screen.getByText('feature/x')).toBeTruthy()
  expect(screen.queryByText('refs/heads/feature/x')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Environment/ }))
  expect(screen.getByText('feature-wt')).toBeTruthy()
  expect(screen.getByText('C:/repos/orca/feature-wt')).toBeTruthy()
  expect(screen.getByText('Feature worktree')).toBeTruthy()
  expect(screen.getByText('Branch')).toBeTruthy()
})

it('shows a folder workspace by its folder and path, without a branch', () => {
  store.repos = [
    {
      id: 'folder-repo',
      path: '/notes',
      displayName: 'Notes',
      badgeColor: '#000',
      addedAt: 0,
      kind: 'folder'
    }
  ]
  store.worktreesByRepo = {
    'folder-repo': [
      {
        id: 'folder-repo::/notes',
        repoId: 'folder-repo',
        path: '/notes',
        branch: '',
        displayName: 'Notes'
      }
    ]
  }
  render(
    <NativeChatSessionSummary
      {...props}
      fileContext={{
        worktreeId: 'folder-repo::/notes',
        worktreePath: '/notes',
        runtimeEnvironmentId: null
      }}
    />
  )
  expect(screen.getByText('notes')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Environment/ }))
  expect(screen.getByText('/notes')).toBeTruthy()
  expect(screen.queryByText('Branch')).toBeNull()
})

it('reports zero running subagents and background tasks when the host confirms none', () => {
  render(<NativeChatSessionSummary {...props} commandActivity={[]} />)
  expect(screen.getByRole('button', { name: /^Subagents/ }).textContent).toContain('0 running')
  expect(screen.getByText('No running subagents')).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Background tasks/ }).textContent).toContain(
    '0 running'
  )
  expect(screen.getByText('No running background tasks')).toBeTruthy()
})

const liveContext: AgentChildRowContext = {
  parentEvidenceFresh: true,
  transportObservation: 'live',
  parentObservedAt: 1_000,
  hostClockOffsetMs: 0
}
function commandView(id: string, changes: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    providerId: `task-${id}`,
    kind: 'command',
    description: id,
    state: 'working',
    membership: 'live',
    firstObservedAt: 100,
    observedAt: 1_000,
    stoppable: true,
    invocation: { invocationId: id, generation: 1 },
    ...changes
  }
}

it('lists running background tasks in the collapsed card, each with a Stop that names it', () => {
  const onStop = vi.fn()
  render(
    <TooltipProvider>
      <NativeChatSessionSummary
        {...props}
        context={liveContext}
        roster={{ state: 'monitoring', supportsTaskStop: true }}
        commandActivity={[
          commandView('build'),
          commandView('tail', {
            membership: 'settled',
            state: 'done',
            settledAt: 900
          })
        ]}
        backgroundStop={{ stoppingTaskIds: new Set(), onStop }}
      />
    </TooltipProvider>
  )

  expect(screen.getByRole('button', { name: /^Background tasks/ }).textContent).toContain(
    '1 running'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Stop build' }))
  expect(onStop).toHaveBeenCalledWith('task-build')
  expect(screen.queryByRole('button', { name: 'Stop tail' })).toBeNull()
})

it('shows running background tasks without a Stop from a host that predates the field', () => {
  render(
    <TooltipProvider>
      <NativeChatSessionSummary
        {...props}
        context={liveContext}
        roster={{ state: 'monitoring' }}
        commandActivity={[commandView('build')]}
        backgroundStop={{ stoppingTaskIds: new Set(), onStop: vi.fn() }}
      />
    </TooltipProvider>
  )

  expect(screen.getByRole('button', { name: /^Background tasks/ }).textContent).toContain(
    '1 running'
  )
  expect(screen.queryByRole('button', { name: 'Stop build' })).toBeNull()
})

const environmentFileContext = {
  worktreeId: 'repo::C:/repos/orca/feature-wt',
  worktreePath: 'C:/repos/orca/feature-wt',
  runtimeEnvironmentId: null
}
const environmentWorktrees = {
  repo: [
    {
      id: 'repo::C:/repos/orca/feature-wt',
      repoId: 'repo',
      path: 'C:/repos/orca/feature-wt',
      branch: 'refs/heads/feature/x',
      displayName: 'Feature worktree'
    }
  ]
}

it('falls back to the bound GitHub account when gh.account is not readable', () => {
  store.repos = [
    {
      id: 'repo',
      path: 'C:/repos/orca',
      displayName: 'Orca',
      badgeColor: '#000',
      addedAt: 0,
      ghAccount: { host: 'github.acme.com', user: 'svc_build' }
    }
  ]
  store.worktreesByRepo = environmentWorktrees
  render(<NativeChatSessionSummary {...props} fileContext={environmentFileContext} />)
  expect(screen.getByText('svc_build@github.acme.com')).toBeTruthy()
  expect(screen.queryByText('No account bound')).toBeNull()
})

it('says no account is bound instead of showing the active gh account', () => {
  store.repos = [
    {
      id: 'repo',
      path: 'C:/repos/orca',
      displayName: 'Orca',
      badgeColor: '#000',
      addedAt: 0
    }
  ]
  store.worktreesByRepo = environmentWorktrees
  render(<NativeChatSessionSummary {...props} fileContext={environmentFileContext} />)
  expect(screen.getByText('No account bound')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Environment/ }))
  expect(screen.getByText('GitHub account')).toBeTruthy()
  expect(screen.getByText('No account bound')).toBeTruthy()
})

it('shows the repo gh.account pin over a differing Orca binding and notes the binding', async () => {
  readGitConfig.mockResolvedValue({ account: 'palominoc-perulaunch', identityManaged: false })
  store.repos = [
    {
      id: 'repo',
      path: 'C:/repos/orca',
      displayName: 'Orca',
      badgeColor: '#000',
      addedAt: 0,
      ghAccount: { host: 'github.com', user: 'palominoc' }
    }
  ]
  store.worktreesByRepo = environmentWorktrees
  render(<NativeChatSessionSummary {...props} fileContext={environmentFileContext} />)
  expect(await screen.findByText('palominoc-perulaunch')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Environment/ }))
  expect(screen.getByText('Orca binding: palominoc')).toBeTruthy()
})

it('shows a repo gh.account pin even when no Orca binding is set', async () => {
  readGitConfig.mockResolvedValue({ account: 'palominoc', identityManaged: false })
  store.repos = [
    { id: 'repo', path: 'C:/repos/orca', displayName: 'Orca', badgeColor: '#000', addedAt: 0 }
  ]
  store.worktreesByRepo = environmentWorktrees
  render(<NativeChatSessionSummary {...props} fileContext={environmentFileContext} />)
  expect(await screen.findByText('palominoc')).toBeTruthy()
  expect(screen.queryByText('No account bound')).toBeNull()
})

const visualOwner = {
  target: { kind: 'environment', environmentId: 'opaque-id' } as const,
  sessionId: 'session-1',
  tabId: 'tab-1',
  worktreeId: 'repo::C:/repos/orca/feature-wt'
}

it('lists a visual the chat shows in Results and opens it in the sidebar', () => {
  const openRightSidebarVisual = vi.fn()
  store.openRightSidebarVisual = openRightSidebarVisual
  const reply: AgentJournalRenderItem = {
    itemId: 'reply-1',
    sequence: 3,
    revision: 1,
    observedAt: 30,
    body: {
      kind: 'message',
      role: 'assistant',
      blocks: [
        {
          type: 'text',
          text: 'Here is the chart.\n\n::orca-visual{file="usage-chart.html" title="Usage by day"}'
        }
      ]
    }
  }
  render(
    <NativeChatVisualOwnerContext.Provider value={visualOwner}>
      <NativeChatSessionSummary {...props} journalItems={[reply]} />
    </NativeChatVisualOwnerContext.Provider>
  )
  fireEvent.click(screen.getByRole('button', { name: /^Results/ }))
  fireEvent.click(screen.getByRole('button', { name: /Usage by day/ }))
  expect(openRightSidebarVisual).toHaveBeenCalledWith({
    target: visualOwner.target,
    sessionId: 'session-1',
    tabId: 'tab-1',
    worktreeId: visualOwner.worktreeId,
    messageId: 'reply-1',
    file: 'usage-chart.html',
    title: 'Usage by day'
  })
})

it('does not list visuals outside a structured chat owner, where no visual can open', () => {
  store.openRightSidebarVisual = vi.fn()
  const reply: AgentJournalRenderItem = {
    itemId: 'reply-1',
    sequence: 3,
    revision: 1,
    observedAt: 30,
    body: {
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: '::orca-visual{file="usage-chart.html"}' }]
    }
  }
  render(<NativeChatSessionSummary {...props} journalItems={[reply]} />)
  fireEvent.click(screen.getByRole('button', { name: /^Results/ }))
  expect(screen.queryByRole('button', { name: /usage-chart/ })).toBeNull()
  expect(screen.getByText('No file changes or visuals reported.')).toBeTruthy()
})
