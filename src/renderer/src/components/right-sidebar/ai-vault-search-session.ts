import { isAiVaultAutomatedRun } from '../../../../shared/ai-vault-automated-run'
import type { AiVaultSearchHit } from '../../../../shared/ai-vault-search-types'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'

export function aiVaultSearchHitToSession(
  hit: AiVaultSearchHit,
  executionHostId: ExecutionHostId
): AiVaultSession {
  const filePath = hit.source.filePath ?? ''
  const timestamp = hit.updatedAt ?? ''

  return {
    id: `${executionHostId}:${hit.agent}:${hit.sessionId}:${filePath}`,
    executionHostId,
    agent: hit.agent,
    sessionId: hit.sessionId,
    title: hit.title,
    cwd: hit.cwd,
    branch: hit.branch,
    model: null,
    filePath,
    codexHome: hit.source.codexHome ?? null,
    createdAt: null,
    updatedAt: hit.updatedAt,
    modifiedAt: timestamp,
    messageCount: hit.messageCount,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: hit.resumeCommand ?? '',
    subagent: null,
    ...(hit.structuredSession ? { structuredSession: hit.structuredSession } : {})
  }
}

/**
 * Search hits carry no opening prompt or spawn marker, so a background run the agent later titled
 * reads as a user chat. The history list knows better; hits it never loaded keep their title check.
 */
export function markAutomatedAiVaultSearchRows(
  rows: readonly AiVaultSession[],
  listed: readonly AiVaultSession[]
): AiVaultSession[] {
  const automated = new Set(listed.filter(isAiVaultAutomatedRun).map(searchRowIdentity))
  return rows.map((row) =>
    automated.has(searchRowIdentity(row)) ? { ...row, headlessRun: true as const } : row
  )
}

// Why: remote hits withhold the file path, so the session id can't include it here.
function searchRowIdentity(session: AiVaultSession): string {
  return JSON.stringify([session.executionHostId, session.agent, session.sessionId])
}

/** A native chat opens through its owner, like its list row; only other hits need a command. */
export function canResumeAiVaultSearchHit(hit: AiVaultSearchHit): boolean {
  return (
    hit.structuredSession !== undefined ||
    (hit.source.presence === 'present' && hit.resumeCommand !== undefined)
  )
}

export function hasAiVaultSearchHitPath(hit: AiVaultSearchHit): boolean {
  return hit.source.presence === 'present' && hit.source.filePath !== undefined
}
