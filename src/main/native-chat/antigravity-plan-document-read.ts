// Reading one Antigravity plan-mode document for the chat that wrote it. The path comes from the
// client's journal, so it is only a claim: the host serves it when it sits directly inside
// `brain/<conversationId>/` for a conversation this session recorded, its own sidecar marks it
// user-facing, and the canonical file stays inside that folder (no symlink, text, size capped).

import { basename, dirname, isAbsolute } from 'node:path'
import {
  AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS,
  PLAN_DOCUMENT_MAX_BYTES,
  type AgentSessionPlanDocumentReadError,
  type AgentSessionReadPlanDocumentResult
} from '../../shared/rpc-contract/agent-session-plan-document-params'
import { readAntigravityArtifactSidecar } from '../antigravity/antigravity-artifact-metadata'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'

const SIDECAR_SUFFIX = '.metadata.json'

function isPlanDocumentError(value: string): value is AgentSessionPlanDocumentReadError {
  return AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS.some((known) => known === value)
}

export async function readAntigravityPlanDocument(input: {
  path: string
  conversationIds: ReadonlySet<string>
  knownRevision?: string
}): Promise<AgentSessionReadPlanDocumentResult> {
  const { path } = input
  const folder = dirname(path)
  const file = basename(path)
  if (
    !isAbsolute(path) ||
    file.endsWith(SIDECAR_SUFFIX) ||
    !input.conversationIds.has(basename(folder)) ||
    basename(dirname(folder)) !== 'brain'
  ) {
    return { ok: false, error: 'outside_folder' }
  }
  if (readAntigravityArtifactSidecar(path)?.userFacing !== true) {
    return { ok: false, error: 'not_a_plan_document' }
  }
  const result = await readNativeChatContainedTextFile(folder, file, input.knownRevision, {
    maxBytes: PLAN_DOCUMENT_MAX_BYTES,
    isAllowedName: (name) => name === file
  })
  if (!result.ok) {
    return { ok: false, error: isPlanDocumentError(result.error) ? result.error : 'not_found' }
  }
  return 'unchanged' in result
    ? result
    : { ok: true, revision: result.revision, sizeBytes: result.sizeBytes, text: result.html }
}
