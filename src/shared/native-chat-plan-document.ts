/** Where the host attaches an Antigravity artifact's own metadata (its `.metadata.json` sidecar) to a
 *  completed file-write call. Absent from older hosts and from non-artifact writes. */
export const ANTIGRAVITY_ARTIFACT_INPUT_KEY = 'antigravityArtifact'

export const MAX_PLAN_DOCUMENT_SUMMARY = 600

export type NativeChatPlanDocument = {
  path: string
  summary: string
  awaitingApproval: boolean
}

const ARTIFACT_WRITE_TOOLS = new Set(['write_file', 'edit_file'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The plan document a completed Antigravity write names: only a file whose sidecar the host read
 *  and marked user-facing. The path and flags are never inferred from the file name or its text. */
export function nativeChatPlanDocumentFromCall(
  name: string,
  input: unknown
): NativeChatPlanDocument | null {
  if (!ARTIFACT_WRITE_TOOLS.has(name) || !isRecord(input)) {
    return null
  }
  const artifact = input[ANTIGRAVITY_ARTIFACT_INPUT_KEY]
  const path = input.Path
  if (!isRecord(artifact) || artifact.userFacing !== true || typeof path !== 'string' || !path) {
    return null
  }
  const summary = typeof artifact.summary === 'string' ? artifact.summary.trim() : ''
  return {
    path,
    summary: summary.slice(0, MAX_PLAN_DOCUMENT_SUMMARY),
    awaitingApproval: artifact.requestFeedback === true
  }
}
