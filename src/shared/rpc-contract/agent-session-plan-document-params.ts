import { z } from 'zod'
import { SessionId } from './structured-agent-session-identifiers'

// `agentSession.readPlanDocument`: the plan-mode document an Antigravity chat wrote, read on the
// host that owns the chat. The client names the session and the path its journal reported; the host
// serves it only when it is a user-facing artifact directly inside that conversation's own
// `brain/<conversationId>/` folder, so this never widens the generic remote file open.

export const PLAN_DOCUMENT_MAX_BYTES = 256 * 1024

const Revision = z.string().regex(/^[0-9a-f]{16,64}$/)

export const ReadPlanDocumentParams = z
  .object({
    sessionId: SessionId,
    path: z.string().min(1).max(4096),
    knownRevision: Revision.optional()
  })
  .strict()

export type AgentSessionReadPlanDocumentParams = z.infer<typeof ReadPlanDocumentParams>

/** Positively observed refusals. Transport loss and an older host are never one of these. */
export const AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS = [
  'session_not_found',
  'unsupported_location',
  'not_a_plan_document',
  'not_found',
  'not_a_file',
  'outside_folder',
  'too_large',
  'not_text'
] as const

export type AgentSessionPlanDocumentReadError =
  (typeof AGENT_SESSION_PLAN_DOCUMENT_READ_ERRORS)[number]

export type AgentSessionReadPlanDocumentResult =
  | { ok: true; revision: string; sizeBytes: number; text: string }
  | { ok: true; revision: string; sizeBytes: number; unchanged: true }
  | { ok: false; error: AgentSessionPlanDocumentReadError }
