import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../../../shared/execution-host'
import type { ExecutionHostHealth } from '../../../../shared/execution-host-registry'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { StructuredChatTerminalViewBlock } from '../native-chat/structured-chat-terminal-view'

export const CREATE_CHAT_WORKSPACE_MODES = ['new-worktree', 'current-checkout'] as const
/** `existing-worktree` is picked from the project's worktree list, not from the mode rows. */
export type CreateChatWorkspaceMode =
  | (typeof CREATE_CHAT_WORKSPACE_MODES)[number]
  | 'existing-worktree'

export const CREATE_CHAT_ACCESS_MODES = ['default', 'accept-edits', 'plan', 'full-access'] as const
export type CreateChatAccessMode = (typeof CREATE_CHAT_ACCESS_MODES)[number]

/** Chat is the structured chat; terminal is the agent's own interface in a terminal tab. */
export type CreateChatSessionView = 'chat' | 'terminal'

export type CreateChatProject = { kind: 'none' } | { kind: 'repo'; repoId: string }

export type CreateChatSelection = {
  executionHostId: ExecutionHostId
  project: CreateChatProject
  workspaceMode: CreateChatWorkspaceMode
  /** The worktree the session is created in, when `workspaceMode` is `existing-worktree`. */
  existingWorktreeId?: string
  agent: TuiAgent
  model?: string
  effort?: string
  accessMode: CreateChatAccessMode
  /** Absent means Chat. */
  sessionView?: CreateChatSessionView
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

/** A worktree of an offered project. `sessions` is null when its host cannot be asked: it is unverifiable. */
export type CreateChatWorktreeOption = {
  worktreeId: string
  repoId: string
  hostId: ExecutionHostId
  branch: string
  sessions: number | null
}

export type CreateChatOptions = {
  hosts: readonly CreateChatHostOption[]
  repos: readonly CreateChatRepoOption[]
  preferredAgent: TuiAgent | null
  projectlessDirectory: string
  /** The worktrees of the offered projects; absent lists none. */
  worktrees?: readonly CreateChatWorktreeOption[]
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
    agent: options.preferredAgent ?? 'claude',
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
  return moveToProject(
    { ...selection, executionHostId: hostId },
    firstOnHost ? { kind: 'repo', repoId: firstOnHost.repoId } : { kind: 'none' }
  )
}

/** Picks a project. A worktree picked under the previous project no longer applies, so it is dropped. */
export function chooseCreateChatProject(
  selection: CreateChatSelection,
  project: CreateChatProject
): CreateChatSelection {
  const unchanged =
    project.kind === 'none'
      ? selection.project.kind === 'none'
      : selection.project.kind === 'repo' && selection.project.repoId === project.repoId
  return unchanged ? selection : moveToProject(selection, project)
}

function moveToProject(
  selection: CreateChatSelection,
  project: CreateChatProject
): CreateChatSelection {
  if (selection.existingWorktreeId === undefined) {
    return { ...selection, project }
  }
  return { ...selection, project, workspaceMode: 'new-worktree', existingWorktreeId: undefined }
}

/** Only a verifiable worktree of the selected project, on the selected host, can take the session. */
export function canSubmitCreateChat(
  draft: string,
  selection: CreateChatSelection,
  repos: readonly CreateChatRepoOption[],
  worktrees: readonly CreateChatWorktreeOption[] = []
): boolean {
  if (draft.trim() === '') {
    return false
  }
  if (selection.project.kind === 'none') {
    return canUseProjectless(selection.executionHostId)
  }
  const repo = findRepo(repos, selection.project)
  if (repo === null || repo.hostId !== selection.executionHostId) {
    return false
  }
  if (selection.workspaceMode !== 'existing-worktree') {
    return true
  }
  return worktrees.some(
    (worktree) =>
      worktree.worktreeId === selection.existingWorktreeId &&
      worktree.repoId === repo.repoId &&
      worktree.hostId === selection.executionHostId &&
      worktree.sessions !== null
  )
}

/** The reason Terminal cannot open this agent, the chat's own reason; null when it can. */
export function createChatTerminalBlock(
  agent: string
): Extract<StructuredChatTerminalViewBlock, 'agent'> | null {
  return isTuiAgent(agent) ? null : 'agent'
}

/** Moves the agent onto one the host offers, preferring the user's default; an empty list keeps it. */
export function withAvailableCreateChatAgent(
  selection: CreateChatSelection,
  agents: readonly TuiAgent[],
  preferredAgent: TuiAgent | null
): CreateChatSelection {
  const first = agents[0]
  if (first === undefined || agents.includes(selection.agent)) {
    return selection
  }
  const agent = preferredAgent && agents.includes(preferredAgent) ? preferredAgent : first
  return { ...selection, agent, model: undefined, effort: undefined }
}
