import { isPathInsideOrEqual } from '../../../src/shared/cross-platform-path'
import { latestSessionConversationTurn } from '../../../src/shared/ai-vault-session-display'
import {
  aiVaultAutomatedRunKind,
  type AiVaultAutomatedRunKind
} from '../../../src/shared/ai-vault-automated-run'
import { aiVaultAgentLabel } from '../../../src/shared/ai-vault-types'
import type { AiVaultSession } from '../../../src/shared/ai-vault-types'
import type { PiRowRuntime } from '../../../src/shared/agent-type-label'
import {
  mobilePiAgentLabel,
  mobilePiRuntimeFromTranscriptPath
} from '../components/mobile-pi-runtime'
import { formatTimeAgo } from '../worktree/agent-row-display'

export type MobileAgentHistoryCard = {
  id: string
  agent: AiVaultSession['agent']
  agentLabel: string
  /** Set only for a Pi session; the runtime its icon and label name. */
  piRuntime?: PiRowRuntime
  /** Set only for a headless run; the badge its metadata line leads with. */
  automatedRunKind?: AiVaultAutomatedRunKind
  title: string
  lastMessage: string
  messageCount: number
  timeAgo: string
  isCurrentWorktree: boolean
}

export type MobileAgentHistoryResumeActionState = {
  disabled: boolean
  loading: boolean
}

// Why: a session belongs to the active worktree when its recorded cwd is inside
// (or equal to) the worktree path; session rows carry no host id, so this is a
// path-prefix check (same logic the desktop badge uses).
export function isSessionInActiveWorktree(
  session: Pick<AiVaultSession, 'cwd'>,
  activeWorktreePath: string | null
): boolean {
  if (!activeWorktreePath || !session.cwd) {
    return false
  }
  return isPathInsideOrEqual(activeWorktreePath, session.cwd)
}

export function buildMobileAgentHistoryCard(
  session: AiVaultSession,
  activeWorktreePath: string | null,
  now: number
): MobileAgentHistoryCard {
  const latestTurn = latestSessionConversationTurn(session)
  const updatedAtMs = Date.parse(session.updatedAt ?? session.modifiedAt)
  const piRuntime =
    session.agent === 'pi' ? mobilePiRuntimeFromTranscriptPath(session.filePath) : undefined
  const automatedRunKind = aiVaultAutomatedRunKind(session)
  return {
    id: session.id,
    agent: session.agent,
    agentLabel: piRuntime ? mobilePiAgentLabel(piRuntime) : aiVaultAgentLabel(session.agent),
    ...(piRuntime ? { piRuntime } : {}),
    ...(automatedRunKind ? { automatedRunKind } : {}),
    title: session.title || 'Untitled session',
    lastMessage: latestTurn?.text.trim() ?? '',
    messageCount: session.messageCount,
    timeAgo: Number.isFinite(updatedAtMs) ? formatTimeAgo(updatedAtMs, now) : '',
    isCurrentWorktree: isSessionInActiveWorktree(session, activeWorktreePath)
  }
}

export function automatedRunBadgeLabel(kind: AiVaultAutomatedRunKind): string {
  return kind === 'review' ? 'Review' : 'SDD'
}

export function buildMobileAgentHistoryResumeActionState(
  sessions: readonly Pick<AiVaultSession, 'id'>[],
  resumingSessionId: string | null
): ReadonlyMap<string, MobileAgentHistoryResumeActionState> {
  return new Map(
    sessions.map((session) => [
      session.id,
      {
        disabled: resumingSessionId !== null,
        loading: resumingSessionId === session.id
      }
    ])
  )
}
