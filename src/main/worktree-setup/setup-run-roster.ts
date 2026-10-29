import type { AgentSessionBackgroundTask } from '../../shared/agent-session-background-task-wire'
import { worktreeSetupTaskId } from '../../shared/worktree-setup-row'
import { worktreeSetupRunsForSession, type WorktreeSetupRun } from './setup-run-registry'

/** A session's setup runs as roster rows: live ones under `tasks`, settled ones under `settledTasks`. */
export function worktreeSetupRunRoster(sessionId: string): {
  tasks: AgentSessionBackgroundTask[]
  settledTasks: AgentSessionBackgroundTask[]
} {
  const runs = worktreeSetupRunsForSession(sessionId)
  return {
    tasks: runs.filter((run) => run.state === 'running').map(setupRunRow),
    settledTasks: runs.filter((run) => run.state !== 'running').map(setupRunRow)
  }
}

function setupRunRow(run: WorktreeSetupRun): AgentSessionBackgroundTask {
  const running = run.state === 'running'
  // Why: a user stop kills the PTY with its own code, so only a run that finished on its own reports one.
  const finished = run.state === 'completed' || run.state === 'failed'
  return {
    id: worktreeSetupTaskId(run.ptyId),
    kind: 'command',
    description: 'Worktree setup',
    state: running ? 'working' : 'done',
    startedAt: run.startedAt,
    stoppable: running,
    origin: 'orca',
    ...(finished && run.exitCode !== undefined ? { exitCode: run.exitCode } : {})
  }
}
