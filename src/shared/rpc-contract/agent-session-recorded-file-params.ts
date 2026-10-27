import { z } from 'zod'
import type { RuntimeFilePreviewResult } from '../runtime-file-contracts'
import { SessionId } from './structured-agent-session-identifiers'

// `agentSession.readRecordedFile`: a file this chat's agent wrote, read on the host that owns the
// chat. The client names the session and a path; the host serves it only when its own journal for
// that session records the agent writing that exact path, so this never widens the generic remote
// file open to arbitrary host paths.

export const AGENT_SESSION_RECORDED_FILE_MODES = ['stat', 'preview'] as const

export const ReadRecordedFileParams = z
  .object({
    sessionId: SessionId,
    path: z.string().min(1).max(4096),
    mode: z.enum(AGENT_SESSION_RECORDED_FILE_MODES)
  })
  .strict()

export type AgentSessionReadRecordedFileParams = z.infer<typeof ReadRecordedFileParams>

/** Positively observed refusals. Transport loss and an older host are never one of these. */
export const AGENT_SESSION_RECORDED_FILE_READ_ERRORS = [
  'session_not_found',
  'unsupported_location',
  'not_recorded',
  'not_found',
  'not_a_file',
  'too_large'
] as const

export type AgentSessionRecordedFileReadError =
  (typeof AGENT_SESSION_RECORDED_FILE_READ_ERRORS)[number]

export type AgentSessionReadRecordedFileResult =
  | { ok: true; mode: 'stat'; size: number; isDirectory: false; mtime: number }
  | ({ ok: true; mode: 'preview' } & RuntimeFilePreviewResult)
  | { ok: false; error: AgentSessionRecordedFileReadError }
