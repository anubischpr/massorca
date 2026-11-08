import type { AgentStatusIpcPayload } from '../../shared/agent-status-ipc-payload'
import {
  mintFleetAgentStatusEvidence,
  type FleetAgentStatusEvidence
} from '../../shared/orchestration-fleet-agent-status-evidence'
import {
  mintAgentStatusFleetEvidence,
  type AgentStatusRuntimeEnrichment,
  type ObservedAgentStatusPaneIdentity
} from '../ipc/agent-status-ipc-boundary'
import type { OrchestrationDb } from './orchestration/db'
import { structuredRowPaneKey, structuredSessionIdsOfRows } from './structured-session-lineage'
import { resolveStructuredWorkerIdentityForSession } from './structured-worker-authority'

/** The runtime facts the fleet snapshot needs: the hook rows, the pane identity lookups the
 *  terminal registry owns, and the identity each pane was observed under when its row arrived. */
export type FleetAgentStatusSnapshotSource = AgentStatusRuntimeEnrichment & {
  getAgentStatusSnapshotFn: (() => AgentStatusIpcPayload[]) | null
  readObservedAgentStatusPaneIdentityFn: (paneKey: string) => ObservedAgentStatusPaneIdentity
}

/**
 * Push-fed hook rows minted into fleet evidence. Callers must redact payload text.
 *
 * Extracted from the `@ts-nocheck` runtime mixin so the minting is type-checked: hook rows carry
 * only a pane key, and it was this hop publishing pane identity into a matcher that compares
 * terminal identity that made every local worker read `missing_status` while it was running.
 */
export function readOrchestrationFleetAgentStatusSnapshot(
  runtime: FleetAgentStatusSnapshotSource,
  db?: OrchestrationDb | null
): readonly FleetAgentStatusEvidence[] {
  return (runtime.getAgentStatusSnapshotFn?.() ?? []).map((entry) => {
    const evidence = mintAgentStatusFleetEvidence(
      entry,
      runtime,
      runtime.readObservedAgentStatusPaneIdentityFn(entry.paneKey)
    )
    return evidence.binding.kind === 'unresolved'
      ? (structuredWorkerEvidence(entry, db) ?? evidence)
      : evidence
  })
}

/**
 * A structured session has no PTY, so its row never resolves through the terminal registry. The
 * worker registry names the worker that session runs, which this host owns in process.
 */
function structuredWorkerEvidence(
  entry: AgentStatusIpcPayload,
  db: OrchestrationDb | null | undefined
): FleetAgentStatusEvidence | null {
  const [sessionId] = structuredSessionIdsOfRows([entry.paneKey])
  if (!sessionId || structuredRowPaneKey(sessionId) !== entry.paneKey) {
    return null
  }
  const identity = resolveStructuredWorkerIdentityForSession(sessionId, db)
  if (!identity) {
    return null
  }
  return mintFleetAgentStatusEvidence(entry, {
    kind: 'pane',
    terminalHandle: identity.handle,
    paneKey: identity.paneKey,
    processIncarnation: identity.processIncarnation
  })
}
