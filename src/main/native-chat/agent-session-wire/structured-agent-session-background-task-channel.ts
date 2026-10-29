import type {
  AgentSessionBackgroundTaskState,
  AgentSessionHistoryRequest,
  AgentSessionHistoryResult
} from '../../../shared/agent-session-wire'
import type { AgentSessionBackgroundTask } from '../../../shared/agent-session-background-task-wire'
import {
  onWorktreeSetupRunsChanged,
  worktreeSetupRunSessionIds
} from '../../worktree-setup/setup-run-registry'
import { worktreeSetupRunRoster } from '../../worktree-setup/setup-run-roster'
import { structuredChildWorkLegacyTasks } from '../../../shared/structured-agent-session-child-work-legacy'
import { structuredRunningChildWork } from '../../../shared/agent-child-work-listing'
import { readStructuredAgentSessionHistoryResult } from './structured-agent-session-history-result'
import {
  structuredQueueSendGate,
  tryReadQueuePublication
} from './structured-agent-session-queued-publication'
import type { AgentSessionHistoryScope } from './agent-session-history-page'
import type {
  AgentSessionSubscribers,
  AgentSessionSubscribeInput
} from './structured-agent-session-subscribers'
import type { StructuredAgentSessionClientDelivery } from './structured-agent-session-client-delivery'
import type { StructuredAgentSessionConversations } from './structured-agent-session-conversations'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from './structured-agent-session-host-types'
import { structuredAgentSessionConversationFence } from './structured-agent-session-provider-child'

/** The chat strip's roster: the host's running child records for one session, the same selection
 *  the session list carries, with the legacy task rows an older client reads derived from them. No
 *  running child is `null`, and the strip hides. Each subscriber's frames carry it; see
 *  `agent-session-subscriber-frame-fields`. */
export class StructuredAgentSessionBackgroundTaskChannel {
  constructor(
    private readonly deps: StructuredAgentSessionHostDeps,
    private readonly sessions: StructuredAgentSessionConversations,
    private readonly subscribers: AgentSessionSubscribers,
    /** The host's accessor: opens a conversation at rest, and never starts an agent. */
    private readonly conversation: (
      sessionId: string
    ) => Promise<StructuredAgentSessionHostSession>,
    private readonly childWork: Pick<
      StructuredAgentSessionClientDelivery,
      'readChildWork' | 'readChildWorkHistory'
    >
  ) {
    // Why: a setup run starting, settling or being bound republishes the roster of its chat.
    onWorktreeSetupRunsChanged((worktreeId) => {
      for (const sessionId of worktreeSetupRunSessionIds(worktreeId)) {
        this.publish(sessionId)
      }
    })
  }

  /** `scope` is for in-process readers; a wire request reads every agent's rows. */
  async history(
    request: AgentSessionHistoryRequest,
    scope?: AgentSessionHistoryScope
  ): Promise<AgentSessionHistoryResult> {
    const journal = (await this.conversation(request.sessionId)).journal
    const result = readStructuredAgentSessionHistoryResult({
      journal,
      record: this.deps.store.getRecord(request.sessionId),
      request,
      scope
    })
    const backgroundTasks = this.read(request.sessionId)
    const queue = tryReadQueuePublication(
      journal,
      structuredQueueSendGate(this.deps.store, request.sessionId)
    )
    const hostNow = this.deps.now?.() ?? Date.now()
    return {
      ...result,
      page: {
        ...result.page,
        hostNow,
        // A stale history answer never replaces newer live subscription state;
        // the client's reducer keeps live-over-history precedence.
        ...(queue !== undefined
          ? {
              queuedMessages: queue.queuedMessages,
              queuePause: queue.queuePause,
              nextQueuedMessageId: queue.nextQueuedMessageId
            }
          : {}),
        backgroundTasks,
        // Settled children too: the chat's expanded Background tasks lists them as finished.
        commandActivity: this.childWork.readChildWorkHistory(request.sessionId) ?? []
      }
    }
  }

  /** Resolves once the conversation is open and the subscriber holds its opening frame. */
  async subscribe(input: AgentSessionSubscribeInput): Promise<() => void> {
    const session = await this.conversation(input.sessionId)
    return this.subscribers.open({
      ...input,
      journal: session.journal,
      fence: structuredAgentSessionConversationFence(this.deps.store, input.sessionId)
    })
  }

  /** The session's child records changed; subscribers whose roster differs get the new one. */
  publish(sessionId: string): void {
    if (this.sessions.get(sessionId)) {
      this.subscribers.republishBackgroundTasks(
        sessionId,
        structuredAgentSessionConversationFence(this.deps.store, sessionId)
      )
    }
  }

  /** Always an answer, never "unknown": the child records are the roster whether or not a provider
   *  holds the session, and a parent row the store lacks has no children in it. */
  read(sessionId: string): AgentSessionBackgroundTaskState | null {
    const session = this.sessions.get(sessionId)
    const views = structuredRunningChildWork(
      (session && this.childWork.readChildWork(sessionId)) ?? []
    )
    const setupRuns = session ? worktreeSetupRunRoster(sessionId) : null
    if (!session || (views.length === 0 && !hasSetupRuns(setupRuns))) {
      return null
    }
    const stops = this.deps.adapter.backgroundTaskStops?.(sessionId)
    const legacy =
      views.length > 0
        ? structuredChildWorkLegacyTasks(views, session.params.provider)
        : { tasks: undefined, settledTasks: undefined }
    // Why: Orca's setup rows ride the same legacy lists, so an older reader draws them as plain command rows.
    const tasks = mergeRows(legacy.tasks, setupRuns?.tasks)
    const settledTasks = mergeRows(legacy.settledTasks, setupRuns?.settledTasks)
    return {
      state: 'monitoring',
      ...(tasks ? { tasks } : {}),
      ...(settledTasks ? { settledTasks } : {}),
      // Explicit on every roster: `false` is the provider saying it cannot stop a task, which an older
      // reader treats exactly as the absent field it used to get.
      supportsTaskStop: stops?.supportsTaskStop === true,
      // A session no live provider holds has nothing a stop could reach.
      ...(stops?.supportsStopAll ? {} : { supportsStopAll: false }),
      children: views
    }
  }
}

function hasSetupRuns(
  runs: { tasks: AgentSessionBackgroundTask[]; settledTasks: AgentSessionBackgroundTask[] } | null
): boolean {
  return runs !== null && (runs.tasks.length > 0 || runs.settledTasks.length > 0)
}

/** Live or settled rows from both sources; no rows stays `undefined`, the shape an older host sends. */
function mergeRows(
  fromViews: AgentSessionBackgroundTask[] | undefined,
  fromSetupRuns: AgentSessionBackgroundTask[] | undefined
): AgentSessionBackgroundTask[] | undefined {
  const rows = [...(fromViews ?? []), ...(fromSetupRuns ?? [])]
  return rows.length > 0 ? rows : undefined
}
