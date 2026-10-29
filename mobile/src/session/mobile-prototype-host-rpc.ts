import {
  CreatePrototypeRequestReplySchema,
  ListPrototypeSetsReplySchema,
  PROTOTYPE_WRITE_ATTACHMENT_ERRORS,
  ReadPrototypeDesignSystemReplySchema,
  ReadPrototypeFileReplySchema,
  WriteAttachmentReplySchema,
  type CreatePrototypeRequestParams,
  type ListPrototypeSetsParams,
  type PrototypeListedDesignSystem,
  type PrototypeListedSet,
  type PrototypeReadFileError,
  type ReadPrototypeDesignSystemParams,
  type ReadPrototypeFileParams,
  type WriteAttachmentParams
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
  /** The host could not write the request folder; the host removed any partial one. */
  | { kind: 'unwritable' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeSets =
  | { kind: 'ready'; sets: PrototypeListedSet[]; designSystems?: PrototypeListedDesignSystem[] }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeFile =
  | { kind: 'ready'; html: string }
  | { kind: 'refused'; error: PrototypeReadFileError }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeDesignSystem =
  | {
      kind: 'ready'
      projectKey: string
      projectName: string
      fileNames: string[]
      tokensJson?: string
      componentsHtml?: string
      systemMd?: string
    }
  /** The host has no such local chat, so it has no project for it. */
  | { kind: 'refused' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

export type MobilePrototypeAttachment =
  | { kind: 'ready'; path: string }
  | { kind: 'refused'; error: (typeof PROTOTYPE_WRITE_ATTACHMENT_ERRORS)[number] }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

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
  const reply = CreatePrototypeRequestReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  if (reply.data.ok) {
    return { kind: 'ready', requestId: reply.data.requestId, folderPath: reply.data.folderPath }
  }
  return reply.data.error === 'unwritable' ? { kind: 'unwritable' } : { kind: 'unsupported' }
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
  const reply = ListPrototypeSetsReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  // Why omitted when absent: an older host sends no design systems, and its answer reads as before.
  return {
    kind: 'ready',
    sets: reply.data.sets,
    ...(reply.data.designSystems !== undefined ? { designSystems: reply.data.designSystems } : {})
  }
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
  const reply = ReadPrototypeFileReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'ready', html: reply.data.html }
    : { kind: 'refused', error: reply.data.error }
}

/** The design system files of the chat's project, read on the host that owns the chat. */
export async function readMobilePrototypeDesignSystem(
  client: HostClient,
  params: ReadPrototypeDesignSystemParams
): Promise<MobilePrototypeDesignSystem> {
  const response = await sendHostRequest(client, 'prototypes.readDesignSystem', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = ReadPrototypeDesignSystemReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  if (!reply.data.ok) {
    return { kind: 'refused' }
  }
  const { ok: _ok, ...files } = reply.data
  return { kind: 'ready', ...files }
}

/** Saves one note screenshot under the request's notes folder on the host and returns its path there. */
export async function writeMobilePrototypeAttachment(
  client: HostClient,
  params: WriteAttachmentParams
): Promise<MobilePrototypeAttachment> {
  const response = await sendHostRequest(client, 'prototypes.writeAttachment', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    return isUnsupportedHost(response) ? { kind: 'unsupported-host' } : { kind: 'unreachable' }
  }
  const reply = WriteAttachmentReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'ready', path: reply.data.path }
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
