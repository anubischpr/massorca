import { z } from 'zod'
import type { ChildBringBackStatus } from '../../shared/child-bring-back'
import type { GitCapabilityCache } from '../../shared/git-capability-cache'
import { isUnsupportedMergeTreeWriteTreeError } from '../../shared/git-merge-tree-capability'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import { readStoredAutomaticBringBack, readStoredChildGit } from './delegation-stored-request'

/** Git in one worktree, on whichever host runs it. */
export type ChildBringBackGit = {
  run: (args: string[]) => Promise<string>
  capabilities: GitCapabilityCache
}

export type ChildBringBackDeps = {
  readRequest: (requestId: string) => DelegationRequestRow | undefined
  readWorkspaceId: (sessionId: string) => string | null
  isSessionWorking: (sessionId: string) => Promise<boolean>
  /** Null when the worktree no longer resolves. */
  gitIn: (workspaceId: string) => Promise<ChildBringBackGit | null>
  tellParent: (parentSessionId: string, text: string) => void
  warn: (message: string, error: unknown) => void
}

function lines(output: string): string[] {
  return output.split(/\r?\n/).filter((line) => line.length > 0)
}

/** A probe whose failure is an answer (`--verify -q`, `symbolic-ref -q`), not an error. */
async function optional(git: ChildBringBackGit, args: string[]): Promise<string> {
  try {
    return (await git.run(args)).trim()
  } catch {
    return ''
  }
}

const GitFailureOutput = z.object({ stdout: z.string() })

/** Null when this Git cannot tell. `merge-tree` exits non-zero with its report on stdout on conflict. */
async function predictConflicts(
  git: ChildBringBackGit,
  parentHead: string,
  childHead: string
): Promise<number | null> {
  // Why: the first line of the report is the tree; the conflicted paths follow it.
  const args = ['merge-tree', '--write-tree', '--name-only', '--no-messages', parentHead, childHead]
  try {
    return await git.capabilities.runWithFallback(
      'merge-tree-write-tree',
      async () => {
        try {
          await git.run(args)
          return 0
        } catch (error) {
          if (isUnsupportedMergeTreeWriteTreeError(error)) {
            throw error
          }
          const output = GitFailureOutput.safeParse(error)
          return output.success ? Math.max(0, lines(output.data.stdout).length - 1) : null
        }
      },
      async () => null,
      isUnsupportedMergeTreeWriteTreeError
    )
  } catch {
    return null
  }
}

type ResolvedChild =
  | { kind: 'no-link' }
  | { kind: 'head'; head: string; uncommitted: number; removed: boolean }
  | { kind: 'gone' }

async function resolveChild(
  deps: ChildBringBackDeps,
  row: DelegationRequestRow,
  parentGit: ChildBringBackGit
): Promise<ResolvedChild> {
  const stored = readStoredChildGit(row)
  const childWorkspaceId = row.child_session_id ? deps.readWorkspaceId(row.child_session_id) : null
  if (childWorkspaceId === null && !stored) {
    return { kind: 'no-link' }
  }
  const childGit = childWorkspaceId === null ? null : await deps.gitIn(childWorkspaceId)
  if (childGit) {
    const head = (await childGit.run(['rev-parse', 'HEAD'])).trim()
    return {
      kind: 'head',
      head,
      uncommitted: lines(await childGit.run(['status', '--porcelain', '--untracked-files=all']))
        .length,
      removed: false
    }
  }
  // A removed worktree keeps its commits while its branch lives.
  const head = stored
    ? await optional(parentGit, ['rev-parse', '--verify', '-q', `refs/heads/${stored.branch}`])
    : ''
  return head ? { kind: 'head', head, uncommitted: 0, removed: true } : { kind: 'gone' }
}

type ChildBringBackRead = { status: ChildBringBackStatus; head: string | null }

const UNAVAILABLE: ChildBringBackRead = {
  status: { kind: 'unavailable' },
  head: null
}

async function readChildBringBack(
  deps: ChildBringBackDeps,
  requestId: string
): Promise<ChildBringBackRead> {
  const row = deps.readRequest(requestId)
  if (!row || row.workspace_kind === 'folder') {
    return UNAVAILABLE
  }
  if (row.status !== 'started' && row.status !== 'finished') {
    return UNAVAILABLE
  }
  const parentWorkspaceId = deps.readWorkspaceId(row.parent_session_id)
  if (parentWorkspaceId === null) {
    return UNAVAILABLE
  }
  const childWorkspaceId = row.child_session_id ? deps.readWorkspaceId(row.child_session_id) : null
  if (childWorkspaceId === parentWorkspaceId) {
    return UNAVAILABLE
  }
  if (
    row.status === 'started' ||
    (row.child_session_id && (await deps.isSessionWorking(row.child_session_id)))
  ) {
    return { status: { kind: 'running' }, head: null }
  }
  const parentGit = await deps.gitIn(parentWorkspaceId)
  if (!parentGit) {
    return UNAVAILABLE
  }
  const child = await resolveChild(deps, row, parentGit)
  if (child.kind === 'no-link') {
    return UNAVAILABLE
  }
  if (child.kind === 'gone') {
    return { status: { kind: 'gone' }, head: null }
  }
  const { head } = child
  const mark = readStoredAutomaticBringBack(row)
  const mergeHead = await optional(parentGit, ['rev-parse', '--verify', '-q', 'MERGE_HEAD'])
  if (mergeHead === head) {
    const unresolved = lines(await parentGit.run(['diff', '--name-only', '--diff-filter=U']))
    return {
      status: {
        kind: 'conflicts',
        unresolved: unresolved.length,
        ...(mark === 'resolving' ? { agentResolving: true } : {})
      },
      head
    }
  }
  const into = await optional(parentGit, ['symbolic-ref', '--short', '-q', 'HEAD'])
  const commits = Number((await parentGit.run(['rev-list', '--count', `HEAD..${head}`])).trim())
  if (commits === 0) {
    const base = readStoredChildGit(row)?.baseSha
    if (base === head) {
      return {
        status: { kind: 'nothing', childUncommitted: child.uncommitted },
        head
      }
    }
    const [merge] = lines(
      await parentGit.run(['rev-list', '--ancestry-path', '--merges', '--reverse', `${head}..HEAD`])
    )
    // Without a stored base, only a merge proves the child had work of its own.
    if (!merge && base === undefined) {
      return {
        status: { kind: 'nothing', childUncommitted: child.uncommitted },
        head
      }
    }
    const commit = await parentGit.run(['rev-parse', '--short', merge ?? head])
    return {
      status: {
        kind: 'brought-back',
        into,
        commit: commit.trim(),
        ...(mark === 'merged' ? { automatically: true } : {})
      },
      head
    }
  }
  const files = lines(await parentGit.run(['diff', '--name-only', `HEAD...${head}`])).length
  const parentAhead = Number((await parentGit.run(['rev-list', '--count', `${head}..HEAD`])).trim())
  const parentUncommitted = lines(
    await parentGit.run(['status', '--porcelain', '--untracked-files=no'])
  ).length
  // A running rebase detaches HEAD, so `into` already covers it; REBASE_HEAD can linger stale.
  const operationRunning =
    mergeHead.length > 0 ||
    (await optional(parentGit, ['rev-parse', '--verify', '-q', 'CHERRY_PICK_HEAD'])).length > 0
  // An operation first: its half-merged files also read as uncommitted work.
  const block =
    into === '' || operationRunning
      ? ('parent-no-branch' as const)
      : parentUncommitted > 0
        ? ('parent-uncommitted' as const)
        : (await deps.isSessionWorking(row.parent_session_id))
          ? ('parent-working' as const)
          : null
  const pending = mark === 'waiting' || mark === 'asked-commit'
  const automatic =
    pending && (await deps.isSessionWorking(row.parent_session_id))
      ? ('waiting' as const)
      : mark === 'asked-commit' && block === 'parent-uncommitted'
        ? ('asked-commit' as const)
        : mark === 'undone' && block === null
          ? ('undone' as const)
          : null
  return {
    status: {
      kind: 'ready',
      commits,
      files,
      into,
      parentAhead,
      childUncommitted: child.uncommitted,
      childWorktreeRemoved: child.removed,
      predictedConflicts: block === null ? await predictConflicts(parentGit, 'HEAD', head) : null,
      block,
      parentUncommitted,
      ...(automatic ? { automatic } : {})
    },
    head
  }
}

/** The host's side of Bring back: reads every answer from git, so a manual merge counts too. */
export class ChildBringBackService {
  private readonly merging = new Set<string>()

  constructor(private readonly deps: ChildBringBackDeps) {}

  private async read(requestId: string): Promise<ChildBringBackRead> {
    try {
      return await readChildBringBack(this.deps, requestId)
    } catch (error) {
      this.deps.warn(`reading bring back of ${requestId} failed`, error)
      return UNAVAILABLE
    }
  }

  async status(requestId: string): Promise<ChildBringBackStatus> {
    return (await this.read(requestId)).status
  }

  private async parentGit(requestId: string): Promise<ChildBringBackGit | null> {
    const row = this.deps.readRequest(requestId)
    const workspaceId = row ? this.deps.readWorkspaceId(row.parent_session_id) : null
    return workspaceId === null ? null : this.deps.gitIn(workspaceId)
  }

  /** Merges only from a state that offers it; a conflict is a state, any other failure throws. */
  async bringBack(requestId: string): Promise<ChildBringBackStatus> {
    if (this.merging.has(requestId)) {
      return this.status(requestId)
    }
    this.merging.add(requestId)
    try {
      const { status, head } = await this.read(requestId)
      const git = await this.parentGit(requestId)
      const row = this.deps.readRequest(requestId)
      if (status.kind !== 'ready' || status.block !== null || !head || !git || !row) {
        return status
      }
      try {
        await git.run(['merge', '--no-ff', '-m', `Merge child session "${row.title}"`, head])
      } catch (error) {
        const after = await this.status(requestId)
        if (after.kind === 'conflicts') {
          return after
        }
        throw error
      }
      return await this.status(requestId)
    } finally {
      this.merging.delete(requestId)
    }
  }

  /** Aborts only this child's merge, never another one running in the parent. */
  async abort(requestId: string): Promise<ChildBringBackStatus> {
    const { status } = await this.read(requestId)
    const git = await this.parentGit(requestId)
    if (status.kind === 'conflicts' && git) {
      await git.run(['merge', '--abort'])
    }
    return this.status(requestId)
  }

  async resolveWithAgent(requestId: string): Promise<void> {
    const row = this.deps.readRequest(requestId)
    const { status } = await this.read(requestId)
    if (!row || status.kind !== 'conflicts') {
      return
    }
    this.deps.tellParent(
      row.parent_session_id,
      `Bringing back child session "${row.title}" stopped on merge conflicts in this worktree. Resolve them, keeping both sides' intent, then finish the merge with git commit.`
    )
  }
}
