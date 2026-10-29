import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import type { DelegatedChildStatus } from '../../shared/delegated-children'
import type { DelegatedChildLinkRow } from '../runtime/orchestration/db/delegation/delegation-request-store'

/** The one read the projection makes; the orchestration database satisfies it. */
export type DelegatedChildLinkReader = {
  listDelegatedChildLinks(sessionIds: readonly string[]): DelegatedChildLinkRow[]
}

/** Marks each local row that is a delegated child of a parent in the same list. */
export function projectDelegatedChildAiVaultSessions(
  result: AiVaultListResult,
  openDb: () => DelegatedChildLinkReader | null
): AiVaultListResult {
  const structuredIds = new Set<string>()
  for (const session of result.sessions) {
    const structuredId = localStructuredSessionId(session)
    if (structuredId) {
      structuredIds.add(structuredId)
    }
  }
  if (structuredIds.size === 0) {
    return result
  }
  let links: DelegatedChildLinkRow[]
  try {
    const db = openDb()
    if (!db) {
      return result
    }
    links = db.listDelegatedChildLinks([...structuredIds])
  } catch (error) {
    // Why: the list is the user's history; a link read that fails leaves the children top-level.
    console.warn('[ai-vault] delegated child links could not be read', error)
    return result
  }
  const linkByChildId = new Map<string, DelegatedChildLinkRow>()
  for (const link of links) {
    if (!linkByChildId.has(link.child_session_id)) {
      linkByChildId.set(link.child_session_id, link)
    }
  }
  let changed = false
  const sessions = result.sessions.map((session) => {
    const structuredId = localStructuredSessionId(session)
    const link = structuredId ? linkByChildId.get(structuredId) : undefined
    if (!link) {
      return session
    }
    changed = true
    return {
      ...session,
      delegatedFrom: {
        parentSessionId: link.parent_session_id,
        status: delegatedChildStatus(link.dispatch_status)
      }
    }
  })
  return changed ? { ...result, sessions } : result
}

export function delegatedChildStatus(
  dispatchStatus: DelegatedChildLinkRow['dispatch_status']
): DelegatedChildStatus {
  switch (dispatchStatus) {
    case 'dispatched':
      return 'working'
    case 'completed':
      return 'succeeded'
    case 'failed':
    case 'circuit_broken':
      return 'failed'
    case 'pending':
    case null:
      return 'not-started'
  }
}

// Why: a child is named by the structured session its host owns; a remote row's id is another host's.
function localStructuredSessionId(session: AiVaultSession): string | null {
  return session.executionHostId === LOCAL_EXECUTION_HOST_ID
    ? (session.structuredSession?.sessionId ?? null)
    : null
}
