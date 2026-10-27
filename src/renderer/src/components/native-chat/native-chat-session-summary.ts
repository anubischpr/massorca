import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { mcpToolIdentity } from '../../../../shared/native-chat-tool-identity'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { workspacePortScanKeyForTarget } from '@/lib/workspace-port-actions'
import { changedFilePathsFromJournalItems } from '../../../../shared/native-chat-journal-changed-paths'
import { CODEX_PLAN_UPDATED_FRAME_KIND } from '../../../../shared/native-chat-provider-frame-summary'
import {
  normalizeNativeChatTaskList,
  type NativeChatTaskList
} from '../../../../shared/native-chat-task-list'
import {
  createNativeChatTaskLedger,
  isNativeChatTaskLedgerTool,
  nativeChatTaskLedgerList,
  observeNativeChatTaskCall,
  observeNativeChatTaskResult
} from '../../../../shared/native-chat-task-ledger'
import {
  nativeChatPlanDocumentFromCall,
  type NativeChatPlanDocument
} from '../../../../shared/native-chat-plan-document'
import { branchName } from '@/lib/git-utils'
import { resolveExplicitFileLinkTargetPath } from '@/lib/explicit-file-link-target'
import { toWorktreeRelativePath } from '@/lib/terminal-links'

/** One changed file: the path to open, and the shorter one to show. */
export type NativeChatResultFile = { absolutePath: string; displayPath: string }

/** Only explicit journal records are results; prose mentioning a file is not a file change. Newest
 *  touch first. With the chat's workspace root, a file reported relative by one tool and absolute by
 *  another is one row, shown relative to that root unless it lies outside it. */
function nativeChatResultFile(path: string, workspaceRoot: string | null): NativeChatResultFile {
  const absolutePath = workspaceRoot
    ? (resolveExplicitFileLinkTargetPath(path, workspaceRoot) ?? path)
    : path
  const relative = workspaceRoot ? toWorktreeRelativePath(absolutePath, workspaceRoot) : null
  return { absolutePath, displayPath: relative || absolutePath }
}

/** Inside the workspace, the Results card's relative path; outside it only the file name, since
 *  agy keeps its documents in its own state folder. The full path stays the tooltip. */
function planDocumentFile(path: string, workspaceRoot: string | null): NativeChatResultFile {
  const file = nativeChatResultFile(path, workspaceRoot)
  const inside = workspaceRoot ? toWorktreeRelativePath(file.absolutePath, workspaceRoot) : null
  return inside
    ? file
    : { ...file, displayPath: workspaceFolderName(file.absolutePath) ?? file.displayPath }
}

export type NativeChatSessionPlanDocument = {
  file: NativeChatResultFile
  summary: string
  awaitingApproval: boolean
  /** Changes whenever the agent rewrites the document, so a viewer reads it again. */
  revisionKey: string
}

/** The newest Antigravity plan document the main agent wrote: a completed write the host marked
 *  user-facing from the artifact's own metadata. Rewrites replace it; failed calls never do. */
export function nativeChatSessionPlanDocument(
  items: readonly AgentJournalRenderItem[],
  workspaceRoot: string | null
): NativeChatSessionPlanDocument | null {
  let latest: (NativeChatPlanDocument & { revisionKey: string }) | null = null
  for (const { body, agentId, itemId, revision } of items) {
    if (agentId === undefined && body.kind === 'tool-call' && body.state === 'completed') {
      const document = nativeChatPlanDocumentFromCall(body.name, body.input)
      latest = document ? { ...document, revisionKey: `${itemId}:${revision}` } : latest
    }
  }
  return latest
    ? {
        file: planDocumentFile(latest.path, workspaceRoot),
        summary: latest.summary,
        awaitingApproval: latest.awaitingApproval,
        revisionKey: latest.revisionKey
      }
    : null
}

export function nativeChatSessionResultFiles(
  items: readonly AgentJournalRenderItem[],
  workspaceRoot: string | null
): NativeChatResultFile[] {
  const lastTouch = new Map<string, { index: number; file: NativeChatResultFile }>()
  for (const [index, path] of changedFilePathsFromJournalItems(items).entries()) {
    const file = nativeChatResultFile(path, workspaceRoot)
    lastTouch.set(file.absolutePath, { index, file })
  }
  return [...lastTouch.values()]
    .sort((left, right) => right.index - left.index)
    .map((entry) => entry.file)
}

export function nativeChatSessionResults(items: readonly AgentJournalRenderItem[]): string[] {
  return nativeChatSessionResultFiles(items, null).map((file) => file.absolutePath)
}

/** A tool result is historical evidence, never a claim that its connector is connected now. */
export function nativeChatSessionConnectors(items: readonly AgentJournalRenderItem[]) {
  const connectors = new Map<
    string,
    { server: string; tool: string; state: string; error: string | null }
  >()
  for (const { body } of items) {
    if (body.kind !== 'tool-call') {
      continue
    }
    const identity = mcpToolIdentity(body.name, body.mcpIdentity)
    if (!identity) {
      continue
    }
    connectors.set(identity.server, {
      ...identity,
      state: body.endedAs ?? body.state,
      error: body.state === 'failed' ? (body.output?.head ?? null) : null
    })
  }
  return [...connectors.values()]
}

/** Never borrow another host's aggregate scan for a selected chat. */
export function nativeChatSessionServers(
  scans: Record<string, WorkspacePortScanResult>,
  target: RuntimeClientTarget,
  worktreeId: string | null | undefined
) {
  const scan = scans[workspacePortScanKeyForTarget(target)]
  return {
    scan,
    ports:
      scan?.ports.filter(
        (port) => port.kind === 'workspace' && port.owner.worktreeId === worktreeId
      ) ?? []
  }
}

/** The main agent's plan as last reported: a TodoWrite or update_plan call, Codex's plan notification,
 *  or the task list Claude's TaskCreate/TaskUpdate calls build up. Subagent rows, failed calls and
 *  truncated notifications never replace it. */
export function nativeChatSessionPlan(
  items: readonly AgentJournalRenderItem[]
): NativeChatTaskList | null {
  let plan: NativeChatTaskList | null = null
  const ledger = createNativeChatTaskLedger()
  for (const [index, { body, agentId }] of items.entries()) {
    if (agentId !== undefined) {
      continue
    }
    if (body.kind === 'tool-call' && isNativeChatTaskLedgerTool(body.name)) {
      const callId = body.callId ?? `item:${index}`
      if (body.state !== 'failed') {
        observeNativeChatTaskCall(ledger, { callId, name: body.name, input: body.input })
        observeNativeChatTaskResult(ledger, {
          callId,
          output: body.output?.head ?? '',
          isError: false
        })
      }
      plan = nativeChatTaskLedgerList(ledger) ?? plan
    } else if (body.kind === 'tool-call') {
      const list =
        body.state === 'failed' ? null : normalizeNativeChatTaskList(body.name, body.input)
      plan = list ?? plan
    } else if (
      body.kind === 'status' &&
      body.providerFrame?.provider === 'codex' &&
      body.providerFrame.kind === CODEX_PLAN_UPDATED_FRAME_KIND &&
      !body.providerFrame.payload.truncated
    ) {
      plan = normalizeNativeChatTaskList('update_plan', body.providerFrame.payload.head) ?? plan
    }
  }
  return plan
}

/** The folder a workspace path ends in, on either separator; null for an empty path. */
export function workspaceFolderName(path: string): string | null {
  return /([^\\/]+)[\\/]*$/.exec(path)?.[1] ?? null
}

/** The branch a git workspace is on without its `refs/heads/` prefix; null when none is reported. */
export function workspaceBranchName(branch: string | null | undefined): string | null {
  const trimmed = branch?.trim()
  return trimmed ? branchName(trimmed) : null
}

/** The `owner/repo` of a cached GitHub identity key, which keeps a host segment only off github.com. */
export function githubSlugFromIdentityKey(key: string): string {
  return key.split('/').slice(-2).join('/')
}
