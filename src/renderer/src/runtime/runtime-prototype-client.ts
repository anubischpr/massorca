import type { z } from 'zod'
import {
  CreatePrototypeRequestReplySchema,
  ListPrototypeSetsReplySchema,
  ReadPrototypeFileReplySchema,
  WriteAttachmentReplySchema,
  type CreatePrototypeRequestParams,
  type CreatePrototypeRequestResult,
  type ListPrototypeSetsParams,
  type ListPrototypeSetsResult,
  type ReadPrototypeFileParams,
  type ReadPrototypeFileResult,
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

/** Writes one note screenshot into the request folder on the host; a refusal comes back as `{ ok: false, error }`. */
export function writePrototypeAttachmentOnHost(
  target: RuntimeClientTarget,
  params: WriteAttachmentParams
): Promise<WriteAttachmentResult> {
  return callPrototypeHost(target, 'prototypes.writeAttachment', params, WriteAttachmentReplySchema)
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
  // Why: the mobile client checks the same schemas, so both platforms read one host reply the same way.
  const reply = schema.safeParse(result)
  if (!reply.success) {
    throw new PrototypeHostMalformedReplyError(method)
  }
  return reply.data
}
