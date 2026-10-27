import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../shared/execution-host'
import type { ExecutionHostHealth } from '../../../../shared/execution-host-registry'
import type { TuiAgent } from '../../../../shared/tui-agent'

export const CREATE_CHAT_WORKSPACE_MODES = ['new-worktree', 'current-checkout'] as const
export type CreateChatWorkspaceMode = (typeof CREATE_CHAT_WORKSPACE_MODES)[number]

export const CREATE_CHAT_ACCESS_MODES = ['default', 'accept-edits', 'plan', 'full-access'] as const
export type CreateChatAccessMode = (typeof CREATE_CHAT_ACCESS_MODES)[number]

export type CreateChatProject = { kind: 'none' } | { kind: 'repo'; repoId: string }

export type CreateChatSelection = {
  executionHostId: ExecutionHostId
  project: CreateChatProject
  workspaceMode: CreateChatWorkspaceMode
  agent: TuiAgent
  model?: string
  effort?: string
  accessMode: CreateChatAccessMode
}

/** `started` means the chat is launching; a failure keeps the draft and names what went wrong. */
export type CreateChatSubmitOutcome = { started: true } | { started: false; message: string }

/** The view only forwards what the user composed; the submit resolves the workspace and launches. */
export type CreateChatSubmit = (
  draft: string,
  selection: CreateChatSelection
) => Promise<CreateChatSubmitOutcome>

export type CreateChatHostOption = {
  id: ExecutionHostId
  label: string
  detail: string
  health: ExecutionHostHealth
}

export type CreateChatRepoOption = {
  repoId: string
  displayName: string
  path: string
  hostId: ExecutionHostId
  isFolder: boolean
}

export type CreateChatOptions = {
  hosts: readonly CreateChatHostOption[]
  repos: readonly CreateChatRepoOption[]
  /** Enabled and detected agents, in launch order. Empty until detection lands. */
  agents: readonly TuiAgent[]
  preferredAgent: TuiAgent | null
  projectlessDirectory: string
}

/** Projectless chats are created on this computer only; T2 rejects SSH with `ssh_location_unsupported`. */
export function canUseProjectless(hostId: ExecutionHostId): boolean {
  return hostId === LOCAL_EXECUTION_HOST_ID
}

export function reposOnHost(
  repos: readonly CreateChatRepoOption[],
  hostId: ExecutionHostId
): CreateChatRepoOption[] {
  return repos.filter((repo) => repo.hostId === hostId)
}

export function findRepo(
  repos: readonly CreateChatRepoOption[],
  project: CreateChatProject
): CreateChatRepoOption | null {
  if (project.kind === 'none') {
    return null
  }
  return repos.find((repo) => repo.repoId === project.repoId) ?? null
}

export function buildDefaultCreateChatSelection(options: CreateChatOptions): CreateChatSelection {
  const localRepo = reposOnHost(options.repos, LOCAL_EXECUTION_HOST_ID)[0]
  return {
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    project: localRepo ? { kind: 'repo', repoId: localRepo.repoId } : { kind: 'none' },
    workspaceMode: 'new-worktree',
    agent: options.agents[0] ?? options.preferredAgent ?? 'claude',
    accessMode: 'default'
  }
}

/** Moves the location, and drops a project the new location cannot host. */
export function chooseCreateChatLocation(
  selection: CreateChatSelection,
  hostId: ExecutionHostId,
  repos: readonly CreateChatRepoOption[]
): CreateChatSelection {
  const current = findRepo(repos, selection.project)
  if (current?.hostId === hostId) {
    return { ...selection, executionHostId: hostId }
  }
  if (selection.project.kind === 'none' && canUseProjectless(hostId)) {
    return { ...selection, executionHostId: hostId }
  }
  const firstOnHost = reposOnHost(repos, hostId)[0]
  return {
    ...selection,
    executionHostId: hostId,
    project: firstOnHost ? { kind: 'repo', repoId: firstOnHost.repoId } : { kind: 'none' }
  }
}

export function canSubmitCreateChat(
  draft: string,
  selection: CreateChatSelection,
  repos: readonly CreateChatRepoOption[]
): boolean {
  if (draft.trim() === '') {
    return false
  }
  if (selection.project.kind === 'none') {
    return canUseProjectless(selection.executionHostId)
  }
  const repo = findRepo(repos, selection.project)
  return repo !== null && repo.hostId === selection.executionHostId
}
