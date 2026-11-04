import {
  ArchivePrototypeRequestReplySchema,
  CreatePrototypeRequestReplySchema,
  DeletePrototypeRequestReplySchema,
  ListPrototypeSetsReplySchema,
  PROTOTYPE_WRITE_ATTACHMENT_ERRORS,
  ReadPrototypeDesignSystemReplySchema,
  ReadPrototypeFileReplySchema,
  RestorePrototypeVersionReplySchema,
  WriteAttachmentReplySchema,
  type CreatePrototypeRequestParams,
  type ListPrototypeSetsParams,
  type PrototypeListedDesignSystem,
  type PrototypeListedSet,
  type PrototypeReadFileError,
  type PrototypeRequestTargetParams,
  type ReadPrototypeDesignSystemParams,
  type ReadPrototypeFileParams,
  type RestorePrototypeVersionParams,
  type WriteAttachmentParams
} from '../../../src/shared/rpc-contract/prototype-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'

// The host's `prototypes.*` answers for the paired computer. Transport loss is never a host verdict,
// and an older host (or one that does not serve structured chats) is `unsupported`.

const READ_TIMEOUT_MS = 15_000

// Hosts whose last listing carried `designSystems`: the field and the createRequest `designSystem` param came
// together, so a host that sent it accepts the param. Keyed by client, so a host never inherits another's answer.
const hostsListingDesignSystems = new WeakSet<object>()

/** Whether the last `prototypes.list` reply of this host carried design systems; false before any listing. */
export function hostListsDesignSystems(client: HostClient): boolean {
  return hostsListingDesignSystems.has(client)
}

/** The one call these reads make, so a test can stand in for the client without a cast. */
type HostClient = Pick<RpcClient, 'sendRequest'>

export type MobilePrototypeRequest =
  | {
      kind: 'ready'
      requestId: string
      folderPath: string
      /** The design system folder on the host, absolute; set when the request uses a design system. */
      designSystemFolderPath?: string
    }
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
    return {
      kind: 'ready',
      requestId: reply.data.requestId,
      folderPath: reply.data.folderPath,
      ...(reply.data.designSystemFolderPath !== undefined
        ? { designSystemFolderPath: reply.data.designSystemFolderPath }
        : {})
    }
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
  if (reply.data.designSystems === undefined) {
    hostsListingDesignSystems.delete(client)
  } else {
    hostsListingDesignSystems.add(client)
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

export type MobilePrototypeRestore =
  /** The host wrote the restored copy as the new current version. */
  | { kind: 'restored'; fileName: string; version: number }
  | { kind: 'refused'; error: 'not_found' | 'conflict' | 'unwritable' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

// Hosts that answered a restore as a method they lack: their sets are offered no restore.
const hostsWithoutPrototypeRestore = new WeakSet<object>()

/** Whether a restore showed this host to predate restoring versions; true until one does. */
export function hostMayRestorePrototypeVersions(client: HostClient): boolean {
  return !hostsWithoutPrototypeRestore.has(client)
}

/** Copies one earlier version of a direction into a new current version on the host that lists it. */
export async function restoreMobilePrototypeVersion(
  client: HostClient,
  params: RestorePrototypeVersionParams
): Promise<MobilePrototypeRestore> {
  const response = await sendHostRequest(client, 'prototypes.restoreVersion', params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    if (!isUnsupportedHost(response)) {
      return { kind: 'unreachable' }
    }
    hostsWithoutPrototypeRestore.add(client)
    return { kind: 'unsupported-host' }
  }
  const reply = RestorePrototypeVersionReplySchema.safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok
    ? { kind: 'restored', fileName: reply.data.fileName, version: reply.data.version }
    : { kind: 'refused', error: reply.data.error }
}

export type MobilePrototypeSetAction =
  | { kind: 'done' }
  /** The host's verdict: the set is gone, cannot be written, or (a delete) its chat and worktree still exist. */
  | { kind: 'refused'; error: 'not_found' | 'unwritable' | 'not_deletable' }
  | { kind: 'unsupported-host' }
  | { kind: 'unreachable' }

// Hosts that answered an archive action as a method they lack: their sets are offered no such action.
const hostsWithoutPrototypeArchive = new WeakSet<object>()

/** Whether an action showed this host to predate archiving; true until one does. */
export function hostMayArchivePrototypes(client: HostClient): boolean {
  return !hostsWithoutPrototypeArchive.has(client)
}

/** Archives one set on the host that lists it. */
export function archiveMobilePrototypeRequest(
  client: HostClient,
  params: PrototypeRequestTargetParams
): Promise<MobilePrototypeSetAction> {
  return sendSetAction(client, 'prototypes.archive', params)
}

/** Brings an archived set back into the list. */
export function unarchiveMobilePrototypeRequest(
  client: HostClient,
  params: PrototypeRequestTargetParams
): Promise<MobilePrototypeSetAction> {
  return sendSetAction(client, 'prototypes.unarchive', params)
}

/** Deletes one set's folder; the host refuses while its chat and worktree still exist. */
export function deleteMobilePrototypeRequest(
  client: HostClient,
  params: PrototypeRequestTargetParams
): Promise<MobilePrototypeSetAction> {
  return sendSetAction(client, 'prototypes.delete', params)
}

async function sendSetAction(
  client: HostClient,
  method: 'prototypes.archive' | 'prototypes.unarchive' | 'prototypes.delete',
  params: PrototypeRequestTargetParams
): Promise<MobilePrototypeSetAction> {
  const response = await sendHostRequest(client, method, params)
  if (response === null) {
    return { kind: 'unreachable' }
  }
  if (!response.ok) {
    if (!isUnsupportedHost(response)) {
      return { kind: 'unreachable' }
    }
    hostsWithoutPrototypeArchive.add(client)
    return { kind: 'unsupported-host' }
  }
  const reply = (
    method === 'prototypes.delete'
      ? DeletePrototypeRequestReplySchema
      : ArchivePrototypeRequestReplySchema
  ).safeParse(response.result)
  if (!reply.success) {
    return { kind: 'unreachable' }
  }
  return reply.data.ok ? { kind: 'done' } : { kind: 'refused', error: reply.data.error }
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
