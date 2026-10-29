import { z } from 'zod'
import {
  PROTOTYPE_CREATE_REQUEST_ERRORS,
  PROTOTYPE_READ_FILE_ERRORS,
  PrototypeListedSetSchema,
  type CreatePrototypeRequestParams,
  type ListPrototypeSetsParams,
  type PrototypeListedSet,
  type PrototypeReadFileError,
  type ReadPrototypeFileParams
} from '../../../src/shared/rpc-contract/prototype-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'

// The host's `prototypes.*` answers for the paired computer. Transport loss is never a host verdict,
// and an older host (or one that does not serve structured chats) is `unsupported`.

const READ_TIMEOUT_MS = 15_000

/** The one call these reads make, so a test can stand in for the client without a cast. */
type HostClient = Pick<RpcClient, 'sendRequest'>

export type MobilePrototypeRequest =
  | { kind: 'ready'; requestId: string; folderPath: string }
  /** The host has no visuals folder for this chat, so no request can be made here. */
  | { kind: 'unsupported' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeSets =
  | { kind: 'ready'; sets: PrototypeListedSet[] }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeFile =
  | { kind: 'ready'; html: string }
  | { kind: 'refused'; error: PrototypeReadFileError }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

const createReplySchema = z.union([
  z.object({ ok: z.literal(true), requestId: z.string(), folderPath: z.string() }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_CREATE_REQUEST_ERRORS) })
])

const listReplySchema = z.object({ sets: z.array(PrototypeListedSetSchema) })

const readReplySchema = z.union([
  z.object({ ok: z.literal(true), html: z.string() }),
  z.object({ ok: z.literal(false), error: z.enum(PROTOTYPE_READ_FILE_ERRORS) })
])

/** Makes a prototype request folder on the chat's host; the agent writes into `folderPath`. */
export async function createMobilePrototypeRequest(
  client: HostClient,
  params: CreatePrototypeRequestParams
): Promise<MobilePrototypeRequest> {
  const response = await sendHostRequest(client, 'prototypes.createRequest', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = createReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'ready', requestId: reply.data.requestId, folderPath: reply.data.folderPath }
    : { kind: 'unsupported' }
}

/** The prototype sets of the paired computer's chats, newest first. */
export async function listMobilePrototypeSets(
  client: HostClient,
  params: ListPrototypeSetsParams
): Promise<MobilePrototypeSets> {
  const response = await sendHostRequest(client, 'prototypes.list', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = listReplySchema.safeParse(response.result)
  return reply.success ? { kind: 'ready', sets: reply.data.sets } : { kind: 'unreachable' }
}

/** The HTML of one set file; the host's refusal is a verdict on the file, not on the connection. */
export async function readMobilePrototypeFile(
  client: HostClient,
  params: ReadPrototypeFileParams
): Promise<MobilePrototypeFile> {
  const response = await sendHostRequest(client, 'prototypes.readFile', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = readReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'ready', html: reply.data.html }
    : { kind: 'refused', error: reply.data.error }
}

/** `null` when no reply came back at all. */
async function sendHostRequest(
  client: HostClient,
  method: string,
  params: unknown
): Promise<RpcResponse | null> {
  try {
    return await client.sendRequest(method, params, {
      timeoutMs: READ_TIMEOUT_MS,
      budgetSpansConnect: true
    })
  } catch {
    return null
  }
}

/** An older host answers a method it lacks with `forbidden`; a host without structured chats says so. */
function isUnsupportedHost(response: Extract<RpcResponse, { ok: false }>): boolean {
  return (
    isMobileMethodUnavailableError(response.error.code, response.error.message) ||
    response.error.code === 'structured_agent_session_unsupported'
  )
}
