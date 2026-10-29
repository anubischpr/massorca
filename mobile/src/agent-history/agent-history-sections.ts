import {
  filterAiVaultSessions,
  groupAiVaultSessions
} from '../../../src/shared/ai-vault-session-filters'
import { applyAiVaultAutomatedRunsSwitch } from '../../../src/shared/ai-vault-automated-run'
import { AI_VAULT_AGENTS } from '../../../src/shared/ai-vault-types'
import type { AiVaultScope, AiVaultSession } from '../../../src/shared/ai-vault-types'
import {
  buildMobileAgentHistoryCard,
  type MobileAgentHistoryCard
} from './agent-history-session-card'

// Why: `data` (not `cards`) is the field name React Native's SectionList reads
// for each section's rows — naming it anything else renders empty sections.
export type MobileAgentHistorySection = {
  key: string
  label: string
  data: MobileAgentHistoryCard[]
}

export type MobileAgentHistoryScopeOptions = {
  query: string
  scope: AiVaultScope
  scopeFilterPaths: readonly string[]
  excludedWorktreePaths?: readonly string[]
  activeWorktreePath: string | null
  now: number
}

// Why: the host treats scopePaths as a WIDENING union (it adds in-scope sessions
// beyond the recency cap, never restricts), so the This worktree/Project tabs must
// narrow on the client like the desktop panel does. Mobile has no project-key
// metadata, so both scoped tabs narrow by cwd path-prefix: This worktree = the active
// worktree path minus nested live worktrees, Project = the active worktree + same-repo
// siblings (the same set deriveMobileAiVaultScopePaths produces). 'all' applies no path
// narrowing. hideEmptySessions matches the desktop default.
export function buildMobileAgentHistorySections(
  sessions: readonly AiVaultSession[],
  options: MobileAgentHistoryScopeOptions & { showAutomatedRuns?: boolean }
): MobileAgentHistorySection[] {
  const { sessions: shown } = applyAiVaultAutomatedRunsSwitch(
    mobileAgentHistoryInScope(sessions, options),
    options.showAutomatedRuns === true
  )
  const groups = groupAiVaultSessions(shown, 'folder')
  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    data: group.sessions.map((session) =>
      buildMobileAgentHistoryCard(session, options.activeWorktreePath, options.now)
    )
  }))
}

/** The "Automated runs" count for this scope and query, whether or not the switch shows them. */
export function countMobileAgentHistoryAutomatedRuns(
  sessions: readonly AiVaultSession[],
  options: MobileAgentHistoryScopeOptions
): number {
  const inScope = mobileAgentHistoryInScope(sessions, options)
  return applyAiVaultAutomatedRunsSwitch(inScope, false).automatedRunCount
}

function mobileAgentHistoryInScope(
  sessions: readonly AiVaultSession[],
  options: MobileAgentHistoryScopeOptions
): AiVaultSession[] {
  // Why: narrow scoped tabs by cwd path-prefix. When the worktree list hasn't
  // loaded yet, scopeFilterPaths is empty — fall back to unnarrowed rather than
  // filtering everything out (which would flash an empty list); the memo re-runs
  // with real paths once worktree.ps resolves.
  const narrowByPath = options.scope !== 'all' && options.scopeFilterPaths.length > 0
  return filterAiVaultSessions(sessions, {
    query: options.query,
    agents: AI_VAULT_AGENTS,
    scope: narrowByPath ? 'workspace' : 'all',
    sort: 'updated',
    activeWorktreePaths: narrowByPath ? options.scopeFilterPaths : [],
    // Why: Project narrows by the same paths, so only This worktree leaves nested worktrees out.
    excludedWorktreePaths:
      narrowByPath && options.scope === 'workspace' ? (options.excludedWorktreePaths ?? []) : [],
    hideEmptySessions: true
  })
}
