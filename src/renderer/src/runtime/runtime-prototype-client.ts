import type { z } from 'zod'
import {
  ArchivePrototypeRequestReplySchema,
  CreatePrototypeRequestReplySchema,
  DeletePrototypeRequestReplySchema,
  ListPrototypeSetsReplySchema,
  ReadPrototypeDesignSystemReplySchema,
  ReadPrototypeFileReplySchema,
  RestorePrototypeVersionReplySchema,
  WriteAttachmentReplySchema,
  type ArchivePrototypeRequestResult,
  type CreatePrototypeRequestParams,
  type CreatePrototypeRequestResult,
  type DeletePrototypeRequestResult,
  type ListPrototypeSetsParams,
  type ListPrototypeSetsResult,
  type PrototypeRequestTargetParams,
  type ReadPrototypeDesignSystemParams,
  type ReadPrototypeDesignSystemResult,
  type ReadPrototypeFileParams,
  type ReadPrototypeFileResult,
  type RestorePrototypeVersionParams,
  type RestorePrototypeVersionResult,
  type WriteAttachmentParams,
  type WriteAttachmentResult
} from '../../../shared/rpc-contract/prototype-params'
import type { RuntimeClientTarget } from './runtime-client-target'
import { callRuntimeRpc } from './runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from './runtime-rpc-result'

const READ_TIMEOUT_MS = 15_000

/** The host predates `prototypes.*`, or does not serve structured chats: the prototypes are fine, the host is old. */
export class PrototypeHostOutdatedError extends Error {
  constructor() {
    super('The remote host does not support prototypes yet')
    this.name = 'PrototypeHostOutdatedError'
  }
}

/** The host answered in a shape its contract does not name; the call fails rather than guessing at the reply. */
export class PrototypeHostMalformedReplyError extends Error {
  constructor(method: string) {
    super(`The remote host sent a malformed reply to ${method}`)
    this.name = 'PrototypeHostMalformedReplyError'
  }
}

/** Makes a prototype request folder on the host that owns the chat, and returns where the agent writes. */
export function createPrototypeRequestOnHost(
  target: RuntimeClientTarget,
  params: CreatePrototypeRequestParams
): Promise<CreatePrototypeRequestResult> {
  return callPrototypeHost(
    target,
    'prototypes.createRequest',
    params,
    CreatePrototypeRequestReplySchema
  )
}

/** The prototype sets of the host's chats, newest first. */
export function listPrototypeSetsOnHost(
  target: RuntimeClientTarget,
  params: ListPrototypeSetsParams
): Promise<ListPrototypeSetsResult> {
  return callPrototypeHost(target, 'prototypes.list', params, ListPrototypeSetsReplySchema)
}

/** The HTML of one set file; a refusal comes back as `{ ok: false, error }`. */
export function readPrototypeSetFileOnHost(
  target: RuntimeClientTarget,
  params: ReadPrototypeFileParams
): Promise<ReadPrototypeFileResult> {
  return callPrototypeHost(target, 'prototypes.readFile', params, ReadPrototypeFileReplySchema)
}

/** Copies an earlier version of one direction into its next version, on the host that owns the chat. */
export function restorePrototypeVersionOnHost(
  target: RuntimeClientTarget,
  params: RestorePrototypeVersionParams
): Promise<RestorePrototypeVersionResult> {
  return callPrototypeHost(
    target,
    'prototypes.restoreVersion',
    params,
    RestorePrototypeVersionReplySchema
  )
}

/** The design system files of the chat's project, read on the host that owns the chat. */
export function readDesignSystemOnHost(
  target: RuntimeClientTarget,
  params: ReadPrototypeDesignSystemParams
): Promise<ReadPrototypeDesignSystemResult> {
  return callPrototypeHost(
    target,
    'prototypes.readDesignSystem',
    params,
    ReadPrototypeDesignSystemReplySchema
  )
}

/** Writes one note screenshot into the request folder on the host; a refusal comes back as `{ ok: false, error }`. */
export function writePrototypeAttachmentOnHost(
  target: RuntimeClientTarget,
  params: WriteAttachmentParams
): Promise<WriteAttachmentResult> {
  return callPrototypeHost(target, 'prototypes.writeAttachment', params, WriteAttachmentReplySchema)
}

/** Archives one set on the host that lists it; a refusal comes back as `{ ok: false, error }`. */
export function archivePrototypeRequestOnHost(
  target: RuntimeClientTarget,
  params: PrototypeRequestTargetParams
): Promise<ArchivePrototypeRequestResult> {
  return callPrototypeHost(target, 'prototypes.archive', params, ArchivePrototypeRequestReplySchema)
}

/** Brings an archived set back into the list. */
export function unarchivePrototypeRequestOnHost(
  target: RuntimeClientTarget,
  params: PrototypeRequestTargetParams
): Promise<ArchivePrototypeRequestResult> {
  return callPrototypeHost(
    target,
    'prototypes.unarchive',
    params,
    ArchivePrototypeRequestReplySchema
  )
}

/** Deletes one set's folder; the host refuses while its chat and worktree still exist. */
export function deletePrototypeRequestOnHost(
  target: RuntimeClientTarget,
  params: PrototypeRequestTargetParams
): Promise<DeletePrototypeRequestResult> {
  return callPrototypeHost(target, 'prototypes.delete', params, DeletePrototypeRequestReplySchema)
}

async function callPrototypeHost<Output>(
  target: RuntimeClientTarget,
  method: string,
  params: unknown,
  schema: z.ZodType<Output>
): Promise<Output> {
  let result: unknown
  try {
    result = await callRuntimeRpc<unknown>(target, method, params, { timeoutMs: READ_TIMEOUT_MS })
  } catch (error) {
    if (
      hasRuntimeRpcErrorCode(error, 'method_not_found') ||
      hasRuntimeRpcErrorCode(error, 'structured_agent_session_unsupported')
    ) {
      throw new PrototypeHostOutdatedError()
    }
    throw error
  }
  // Why: the mobile client parses the same schemas, so both accept the same replies; a reply that fails
  // them fails the call here, and mobile reads it as unreachable.
  const reply = schema.safeParse(result)
  if (!reply.success) {
    throw new PrototypeHostMalformedReplyError(method)
  }
  return reply.data
}
