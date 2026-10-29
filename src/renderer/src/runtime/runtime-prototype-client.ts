import type {
  CreatePrototypeRequestParams,
  CreatePrototypeRequestResult,
  ListPrototypeSetsParams,
  ListPrototypeSetsResult,
  ReadPrototypeFileParams,
  ReadPrototypeFileResult
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

/** Makes a prototype request folder on the host that owns the chat, and returns where the agent writes. */
export function createPrototypeRequestOnHost(
  target: RuntimeClientTarget,
  params: CreatePrototypeRequestParams
): Promise<CreatePrototypeRequestResult> {
  return callPrototypeHost(target, 'prototypes.createRequest', params)
}

/** The prototype sets of the host's chats, newest first. */
export function listPrototypeSetsOnHost(
  target: RuntimeClientTarget,
  params: ListPrototypeSetsParams
): Promise<ListPrototypeSetsResult> {
  return callPrototypeHost(target, 'prototypes.list', params)
}

/** The HTML of one set file; a refusal comes back as `{ ok: false, error }`. */
export function readPrototypeSetFileOnHost(
  target: RuntimeClientTarget,
  params: ReadPrototypeFileParams
): Promise<ReadPrototypeFileResult> {
  return callPrototypeHost(target, 'prototypes.readFile', params)
}

async function callPrototypeHost<TResult>(
  target: RuntimeClientTarget,
  method: string,
  params: unknown
): Promise<TResult> {
  try {
    return await callRuntimeRpc<TResult>(target, method, params, { timeoutMs: READ_TIMEOUT_MS })
  } catch (error) {
    if (
      hasRuntimeRpcErrorCode(error, 'method_not_found') ||
      hasRuntimeRpcErrorCode(error, 'structured_agent_session_unsupported')
    ) {
      throw new PrototypeHostOutdatedError()
    }
    throw error
  }
}
