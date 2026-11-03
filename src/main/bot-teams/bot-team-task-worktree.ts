import { randomUUID } from 'node:crypto'
import type { BotTeamProjectWorkspace } from '../../shared/rpc-contract/bot-team-room-params'
import { delegationWorktreeName } from '../delegated-session/delegation-launch'
import { isClearlyReadOnlyDelegationTask } from '../delegated-session/delegation-read-only-task'
import { folderWorkspaceKey } from '../../shared/workspace-scope'
import type { RpcContext } from '../runtime/rpc/core'
import { waitForStructuredSetup } from '../runtime/rpc/methods/agent-launch-worktree-creation'
import {
  findBotTeamWorkspaceProject,
  workspaceProjectSource,
  type WorkspaceProjectSource
} from './bot-team-project-workspace'

export type LinkedTaskWorkspaceDeps = {
  source: WorkspaceProjectSource
  /** Makes the child worktree of a repo that one task runs in; resolves to its worktree id. */
  createChildWorktree: (args: {
    repoId: string
    name: string
    displayName: string
    parentWorktreeId: string | null
  }) => Promise<string>
  /** Rewrites a link that named a worktree so it names the worktree's project. */
  relinkProject: (projectId: string, workspace: BotTeamProjectWorkspace) => void
}

/**
 * The workspace a linked project's task runs in, or null when the linked project is gone. A git
 * repo gives a task its own child worktree unless it clearly only reads (the child-session rule),
 * which runs in the main checkout; a folder project has no worktree to branch and runs in place.
 */
export async function prepareLinkedTaskWorkspace(
  deps: LinkedTaskWorkspaceDeps,
  task: { projectId: string; taskTitle: string; taskPrompt?: string; workspaceKey: string }
): Promise<string | null> {
  const project = await findBotTeamWorkspaceProject(deps.source, task.workspaceKey)
  if (!project) {
    return null
  }
  if (project.entry.key !== task.workspaceKey) {
    deps.relinkProject(task.projectId, { key: project.entry.key, name: project.entry.name })
  }
  if (project.home.type === 'folder') {
    return project.home.workspaceId
  }
  const text = { summary: task.taskTitle, title: task.taskTitle, prompt: task.taskPrompt ?? '' }
  if (project.home.mainWorktreeId && isClearlyReadOnlyDelegationTask(text)) {
    return project.home.mainWorktreeId
  }
  return deps.createChildWorktree({
    repoId: project.home.repoId,
    // Why: a start retried after a failed delivery must not collide with the worktree it left.
    name: delegationWorktreeName(task.taskTitle, randomUUID()),
    displayName: task.taskTitle,
    parentWorktreeId: project.home.mainWorktreeId
  })
}

/**
 * The path of a linked project's main checkout on this host, for a read-only turn; null when the
 * project is gone, has no checkout row, or lives on a remote (SSH) host this query cannot reach.
 */
export async function linkedProjectReadPath(
  source: WorkspaceProjectSource,
  workspaceKey: string,
  isRemoteRepo: (repoId: string) => boolean
): Promise<string | null> {
  const project = await findBotTeamWorkspaceProject(source, workspaceKey)
  if (!project || (project.home.type === 'repo' && isRemoteRepo(project.home.repoId))) {
    return null
  }
  const checkoutId =
    project.home.type === 'repo' ? project.home.mainWorktreeId : project.home.workspaceId
  const row = (await source.listWorktreeRows()).find((entry) => entry.id === checkoutId)
  if (row) {
    return row.path
  }
  // A group's folder workspace has no worktree row: its own folder is the checkout.
  return (
    source.listFolderWorkspaces().find((entry) => folderWorkspaceKey(entry.id) === checkoutId)
      ?.folderPath ?? null
  )
}

/** The host's own wiring: its repos and worktrees, and the same worktree create a delegated child uses. */
export function linkedTaskWorkspaceDeps(runtime: RpcContext['runtime']): LinkedTaskWorkspaceDeps {
  return {
    source: workspaceProjectSource(runtime),
    createChildWorktree: async ({ repoId, name, displayName, parentWorktreeId }) => {
      const created = await runtime.createManagedWorktree({
        repoSelector: `id:${repoId}`,
        name,
        displayName,
        displayNameKind: 'user',
        runHooks: false,
        setupDecision: 'run',
        awaitTerminalProvisioning: true,
        observeSetupCompletion: true,
        activate: false,
        // A task runs in the background; the main checkout is only its parent in the lineage.
        lineage: parentWorktreeId ? { parentWorktree: parentWorktreeId } : { noParent: true }
      })
      // As a Workspaces chat launch does: the agent starts once the repo's setup has finished.
      await waitForStructuredSetup(runtime, created.setupReceipt)
      return created.worktree.id
    },
    relinkProject: (projectId, workspace) =>
      runtime.getOrchestrationDb().setBotTeamProjectWorkspace(projectId, workspace)
  }
}
