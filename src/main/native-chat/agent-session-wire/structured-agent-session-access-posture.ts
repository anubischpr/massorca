import {
  agentSessionAccessPosture,
  accessPickChangesOnlyRecord
} from '../../../shared/agent-session-access-equivalence'
import type { AgentSessionExplicitAccess } from '../../../shared/agent-session-access-mode'
import type { StructuredAgentSessionHostDeps } from './structured-agent-session-host-types'

type PostureDeps = Pick<StructuredAgentSessionHostDeps, 'resolveInheritedFullAccess'> & {
  store: Pick<StructuredAgentSessionHostDeps['store'], 'getRecord'>
}

/** What a child starting now runs as, from the pick its record carries and the global setting at
 *  this moment; undefined when `inherit` cannot be resolved here. */
export function launchedAccessPosture(
  deps: PostureDeps,
  sessionId: string
): AgentSessionExplicitAccess | undefined {
  const record = deps.store.getRecord(sessionId)
  const mode = record?.options?.accessMode
  const inherited = record ? deps.resolveInheritedFullAccess?.(record.provider) : undefined
  if (mode !== undefined && mode !== 'inherit') {
    return agentSessionAccessPosture(mode, false) ?? undefined
  }
  return inherited === undefined
    ? undefined
    : (agentSessionAccessPosture(mode, inherited) ?? undefined)
}

/** The explicit picks that change only the record of a session whose child runs as `running`: the
 *  child already holds that posture, so nothing live is widened and no process is touched. */
export function recordOnlyAccessPicks<T extends string>(input: {
  deps: PostureDeps
  sessionId: string
  running: AgentSessionExplicitAccess | undefined
  candidates: readonly T[]
}): T[] {
  const record = input.deps.store.getRecord(input.sessionId)
  const inheritedFullAccess = record
    ? input.deps.resolveInheritedFullAccess?.(record.provider)
    : undefined
  return input.candidates.filter((target) =>
    accessPickChangesOnlyRecord({
      current: record?.options?.accessMode,
      target,
      running: input.running,
      inheritedFullAccess
    })
  )
}
