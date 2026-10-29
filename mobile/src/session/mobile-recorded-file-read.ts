import { z } from 'zod'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'

/** The host's own refusals for `agentSession.readRecordedFile`. Transport loss is never one of these. */
export const RECORDED_FILE_REFUSALS = [
  'session_not_found',
  'unsupported_location',
  'not_recorded',
  'not_found',
  'not_a_file',
  'too_large'
] as const

export type MobileRecordedFileRefusal = (typeof RECORDED_FILE_REFUSALS)[number]

export type MobileRecordedFileRead =
  | { kind: 'ready'; content: string }
  /** The file is there but holds bytes a text viewer cannot show. */
  | { kind: 'binary' }
  /** The host positively refused: say why, and do not ask again on its own. */
  | { kind: 'refused'; reason: MobileRecordedFileRefusal }
  /** The paired computer predates the method. Asking again will not help. */
  | { kind: 'unavailable' }
  /** No verdict: the host did not answer, or its answer did not parse. Worth a manual retry. */
  | { kind: 'unreachable' }

/** The host's reply, read as the mobile needs it. Unknown members pass through untouched. */
const recordedFilePreviewReplySchema = z.union([
  z.looseObject({
    ok: z.literal(true),
    mode: z.literal('preview'),
    content: z.string(),
    isBinary: z.boolean()
  }),
  z.looseObject({
    ok: z.literal(false),
    error: z.enum(RECORDED_FILE_REFUSALS)
  })
])

/** The mobile's copy of the desktop's refusal messages, one per reason. */
export const RECORDED_FILE_REFUSAL_COPY: Record<MobileRecordedFileRefusal, string> = {
  session_not_found: 'The paired computer no longer has this chat',
  unsupported_location: 'This chat runs somewhere the paired computer cannot read files from',
  not_recorded: 'The agent did not save this file on the paired computer',
  not_found: 'This file is no longer on the paired computer',
  not_a_file: 'This is not a regular file',
  too_large: 'This file is too large to open over the connection'
}

/** Codes an older host answers with: the method is absent, or not allowed to phones. A structured
 *  chat the host does not serve answers the same way. */
export function isRecordedFileMethodUnavailable(code: string, message: string): boolean {
  return (
    isMobileMethodUnavailableError(code, message) || code === 'structured_agent_session_unsupported'
  )
}

/** The verdict a host reply carries. A reply that does not parse is no verdict at all. */
export function recordedFileReadFromReply(reply: unknown): MobileRecordedFileRead {
  const parsed = recordedFilePreviewReplySchema.safeParse(reply)
  if (!parsed.success) {
    return { kind: 'unreachable' }
  }
  const value = parsed.data
  if (value.ok === false) {
    return { kind: 'refused', reason: value.error }
  }
  if (value.isBinary) {
    return { kind: 'binary' }
  }
  return { kind: 'ready', content: value.content }
}

/** Reads one file the chat's agent recorded, from the host that owns the chat. Never throws. */
export async function readMobileRecordedFile(
  source: MobileChatSurfaceRecordedSource,
  path: string
): Promise<MobileRecordedFileRead> {
  let response: RpcResponse
  try {
    response = await requestRecordedFile(source.client, {
      sessionId: source.sessionId,
      path,
      mode: 'preview'
    })
  } catch {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isRecordedFileMethodUnavailable(response.error.code, response.error.message)
      ? { kind: 'unavailable' }
      : { kind: 'unreachable' }
  }
  return recordedFileReadFromReply(response.result)
}

const READ_TIMEOUT_MS = 15_000

/** The method is not in the generated params catalog yet, so the call is untyped on the way out and
 *  validated on the way back. Other `agentSession.*` calls share this shape. */
function requestRecordedFile(
  client: RpcClient,
  params: { sessionId: string; path: string; mode: 'preview' }
): Promise<RpcResponse> {
  return client.sendRequest('agentSession.readRecordedFile', params, {
    timeoutMs: READ_TIMEOUT_MS,
    budgetSpansConnect: true
  })
}
