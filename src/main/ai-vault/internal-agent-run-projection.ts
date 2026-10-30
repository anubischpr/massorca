import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import {
  AI_VAULT_AGENTS,
  type AiVaultListResult,
  type AiVaultSession
} from '../../shared/ai-vault-types'
import { listInternalAgentRuns, type InternalAgentRun } from './internal-agent-run-registry'

// Clock and flush slack between the spawn and the first/last transcript write.
const CLOCK_SLACK_MS = 5_000
// Longest an unfinished record can still own a transcript (the app quit mid-run).
const UNFINISHED_RUN_MAX_MS = 10 * 60_000

/**
 * Marks local rows left by a background run MassOrca started as `headlessRun`, so the list hides
 * them with the other automated runs. Matches on agent, working directory and the run's time
 * window, never on the title.
 */
export function projectInternalAgentRunAiVaultSessions(
  result: AiVaultListResult,
  runs: readonly InternalAgentRun[] = listInternalAgentRuns()
): AiVaultListResult {
  if (runs.length === 0) {
    return result
  }
  let changed = false
  const sessions = result.sessions.map((session) => {
    if (session.headlessRun || !isInternalAgentRunSession(session, runs)) {
      return session
    }
    changed = true
    return { ...session, headlessRun: true as const }
  })
  return changed ? { ...result, sessions } : result
}

function isInternalAgentRunSession(
  session: AiVaultSession,
  runs: readonly InternalAgentRun[]
): boolean {
  if (session.executionHostId !== LOCAL_EXECUTION_HOST_ID || !session.cwd) {
    return false
  }
  const startedMs = parseMs(session.createdAt)
  if (startedMs === null) {
    return false
  }
  const lastActivityMs = parseMs(session.updatedAt) ?? startedMs
  const cwd = comparableCwd(session.cwd)
  return runs.some((run) => {
    const windowEndMs = run.endedAtMs ?? run.startedAtMs + UNFINISHED_RUN_MAX_MS
    return (
      agentMatches(run.agentId, session.agent) &&
      comparableCwd(run.cwd) === cwd &&
      startedMs >= run.startedAtMs - CLOCK_SLACK_MS &&
      startedMs <= windowEndMs + CLOCK_SLACK_MS &&
      // A session the user kept using after the run ended is theirs, not the run's.
      lastActivityMs <= windowEndMs + CLOCK_SLACK_MS
    )
  })
}

function agentMatches(runAgentId: string, sessionAgent: AiVaultSession['agent']): boolean {
  const listed = AI_VAULT_AGENTS.some((agent) => agent === runAgentId)
  return !listed || runAgentId === sessionAgent
}

function parseMs(iso: string | null): number | null {
  const ms = iso ? Date.parse(iso) : Number.NaN
  return Number.isFinite(ms) ? ms : null
}

function comparableCwd(cwd: string): string {
  const slashed = cwd.replaceAll('\\', '/').replace(/\/+$/, '')
  return /^[a-z]:/i.test(slashed) || slashed.startsWith('//') ? slashed.toLowerCase() : slashed
}
