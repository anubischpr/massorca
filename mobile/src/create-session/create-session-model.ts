import {
  getExecutionHostLabel,
  getLocalExecutionHostLabel,
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  type ExecutionHostId
} from '../../../src/shared/execution-host'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import { resolveMobileNewWorkspaceDialogRepoId } from '../worktree/new-workspace-dialog-repo-selection'

export const CREATE_SESSION_WORKSPACE_MODES = ['new-worktree', 'current-checkout'] as const
export type CreateSessionWorkspaceMode = (typeof CREATE_SESSION_WORKSPACE_MODES)[number]

export type CreateSessionSelection = {
  hostId: ExecutionHostId
  repoId: string | null
  workspaceMode: CreateSessionWorkspaceMode
  agent: TuiAgent | null
}

export type CreateSessionHostOption = {
  id: ExecutionHostId
  label: string
  detail: string
}

export type CreateSessionChoice = {
  value: string
  label: string
  description: string
  disabled?: boolean
}

export function repoHostId(repo: MobileWorkspaceRepo): ExecutionHostId {
  return getRepoExecutionHostId(repo)
}

export function isFolderRepo(repo: MobileWorkspaceRepo | null): boolean {
  return repo?.kind === 'folder'
}

export function reposOnHost(
  repos: readonly MobileWorkspaceRepo[],
  hostId: ExecutionHostId
): MobileWorkspaceRepo[] {
  return repos.filter((repo) => repoHostId(repo) === hostId)
}

export function findSelectedRepo(
  repos: readonly MobileWorkspaceRepo[],
  selection: CreateSessionSelection
): MobileWorkspaceRepo | null {
  return repos.find((repo) => repo.id === selection.repoId) ?? null
}

/** One entry per execution host that has a project; the paired computer comes first. */
export function buildCreateSessionHostOptions(
  repos: readonly MobileWorkspaceRepo[],
  labels: {
    hostLabelById: ReadonlyMap<ExecutionHostId, string>
    hostPlatform: NodeJS.Platform | null
  }
): CreateSessionHostOption[] {
  const counts = new Map<ExecutionHostId, number>()
  for (const repo of repos) {
    const hostId = repoHostId(repo)
    counts.set(hostId, (counts.get(hostId) ?? 0) + 1)
  }
  const options = [...counts].map(([id, count]) => ({
    id,
    label:
      id === LOCAL_EXECUTION_HOST_ID
        ? getLocalExecutionHostLabel(labels.hostPlatform)
        : (labels.hostLabelById.get(id) ?? getExecutionHostLabel(id)),
    detail: count === 1 ? '1 project' : `${count} projects`
  }))
  return options.sort(
    (left, right) =>
      Number(right.id === LOCAL_EXECUTION_HOST_ID) - Number(left.id === LOCAL_EXECUTION_HOST_ID)
  )
}

export function buildDefaultCreateSessionSelection(args: {
  repos: readonly MobileWorkspaceRepo[]
  lastVisitedRepoId: string | null
}): CreateSessionSelection {
  const repoId = resolveMobileNewWorkspaceDialogRepoId({
    eligibleRepos: args.repos,
    activeRepoId: args.lastVisitedRepoId
  })
  const repo = args.repos.find((candidate) => candidate.id === repoId) ?? null
  return {
    hostId: repo ? repoHostId(repo) : LOCAL_EXECUTION_HOST_ID,
    repoId: repo?.id ?? null,
    workspaceMode: 'new-worktree',
    agent: null
  }
}

/** Moves to a host, and drops a project that host cannot run. */
export function chooseCreateSessionHost(
  selection: CreateSessionSelection,
  hostId: ExecutionHostId,
  repos: readonly MobileWorkspaceRepo[]
): CreateSessionSelection {
  const current = findSelectedRepo(repos, selection)
  if (current && repoHostId(current) === hostId) {
    return { ...selection, hostId }
  }
  const first = reposOnHost(repos, hostId)[0]
  return { ...selection, hostId, repoId: first?.id ?? null, agent: null }
}

export function chooseCreateSessionRepo(
  selection: CreateSessionSelection,
  repoId: string,
  repos: readonly MobileWorkspaceRepo[]
): CreateSessionSelection {
  const repo = repos.find((candidate) => candidate.id === repoId)
  if (!repo) {
    return selection
  }
  const hostId = repoHostId(repo)
  // A different host detects different agents, so the pick is re-resolved there.
  return {
    ...selection,
    repoId,
    hostId,
    agent: hostId === selection.hostId ? selection.agent : null
  }
}

/** A folder has no branches to isolate, so it always runs in place. */
export function effectiveWorkspaceMode(
  selection: CreateSessionSelection,
  repo: MobileWorkspaceRepo | null
): CreateSessionWorkspaceMode {
  return isFolderRepo(repo) ? 'current-checkout' : selection.workspaceMode
}

export function buildWorkspaceModeChoices(repo: MobileWorkspaceRepo | null): CreateSessionChoice[] {
  const folder = isFolderRepo(repo)
  return [
    {
      value: 'new-worktree',
      label: 'New worktree',
      description: 'Isolated branch created from the base branch',
      disabled: folder
    },
    {
      value: 'current-checkout',
      label: 'Current checkout',
      description: 'Work directly on the open branch',
      disabled: folder
    }
  ]
}

export function workspaceModeChipLabel(
  selection: CreateSessionSelection,
  repo: MobileWorkspaceRepo | null
): string {
  if (isFolderRepo(repo)) {
    return 'No Git'
  }
  return selection.workspaceMode === 'new-worktree' ? 'New worktree' : 'Current checkout'
}

export function parseWorkspaceMode(value: string): CreateSessionWorkspaceMode | null {
  return CREATE_SESSION_WORKSPACE_MODES.find((mode) => mode === value) ?? null
}

export function projectChoiceDescription(repo: MobileWorkspaceRepo): string {
  return isFolderRepo(repo) ? `Folder · no Git · ${repo.path}` : repo.path
}

/** Agents the host found and the user has not disabled; `null` detection means still looking. */
export function selectableCreateSessionAgents(
  catalog: readonly { id: TuiAgent }[],
  filters: { detectedAgentIds: ReadonlySet<string> | null; isEnabled: (agent: TuiAgent) => boolean }
): TuiAgent[] {
  return catalog
    .map((entry) => entry.id)
    .filter(
      (id) =>
        filters.isEnabled(id) &&
        (filters.detectedAgentIds === null || filters.detectedAgentIds.has(id))
    )
}

/** Keeps a still-available agent, else the user's default, else the first one found. */
export function withAvailableCreateSessionAgent(
  selection: CreateSessionSelection,
  agents: readonly TuiAgent[],
  preferred: TuiAgent | null
): CreateSessionSelection {
  const first = agents[0]
  if (first === undefined) {
    return selection.agent === null ? selection : { ...selection, agent: null }
  }
  if (selection.agent !== null && agents.includes(selection.agent)) {
    return selection
  }
  const agent = preferred !== null && agents.includes(preferred) ? preferred : first
  return { ...selection, agent }
}

export function canSubmitCreateSession(args: {
  draft: string
  selection: CreateSessionSelection
  repos: readonly MobileWorkspaceRepo[]
  sshReady: boolean
  busy: boolean
}): boolean {
  if (args.busy || !args.sshReady || args.draft.trim() === '' || args.selection.agent === null) {
    return false
  }
  const repo = findSelectedRepo(args.repos, args.selection)
  return repo !== null && repoHostId(repo) === args.selection.hostId
}

export function createSessionFootnote(
  selection: CreateSessionSelection,
  repo: MobileWorkspaceRepo | null,
  hostLabel: string
): string {
  if (!repo) {
    return 'Add a project on your computer to start a session'
  }
  const verb =
    effectiveWorkspaceMode(selection, repo) === 'new-worktree' ? 'New worktree on' : 'Runs in'
  return `${verb} ${repo.displayName} · ${hostLabel}`
}
