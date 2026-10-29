// `prototypes.*`: the prototype requests a chat's agent writes, kept by the host beside the chat.
//
// Additive: an older host answers `method_not_found`, which a client reads as "unsupported". The
// host resolves every folder from its own state directory and the chat's record; a client names a
// session, a request id or a file name, never a path.

import type { AgentSessionRecord } from '../../../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import {
  CreatePrototypeRequestParams,
  ListPrototypeSetsParams,
  ReadPrototypeFileParams,
  type CreatePrototypeRequestResult,
  type ListPrototypeSetsResult,
  type ReadPrototypeFileResult
} from '../../../../shared/rpc-contract/prototype-params'
import {
  createPrototypeRequest,
  listPrototypeSets,
  readPrototypeSetFile
} from '../../../native-chat/prototype-requests'
import { getProfileUserDataPath } from '../../../orca-profiles/profile-storage-paths'
import { defineMethod } from '../core'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

/** Structured chats run on their owning runtime's own filesystem; any other location has no folder here. */
function isLocalStructuredChat(record: Pick<AgentSessionRecord, 'location'>): boolean {
  return record.location.executionHostId === LOCAL_EXECUTION_HOST_ID && !record.location.wslDistro
}

export const STRUCTURED_AGENT_SESSION_PROTOTYPE_METHODS = [
  defineMethod({
    name: 'prototypes.createRequest',
    permission: 'workspace',
    params: CreatePrototypeRequestParams,
    handler: async (params, ctx): Promise<CreatePrototypeRequestResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const record = host.deps.store.getRecord(params.sessionId)
      if (!record || !isLocalStructuredChat(record)) {
        return { ok: false, error: 'unsupported' }
      }
      return createPrototypeRequest({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        launchDirectory: record.launchDirectory,
        request: params,
        now: new Date(),
        random: Math.random
      })
    }
  }),
  defineMethod({
    name: 'prototypes.list',
    permission: 'workspace',
    params: ListPrototypeSetsParams,
    handler: async (params, ctx): Promise<ListPrototypeSetsResult> => {
      await requireInstalledStructuredHost(ctx)
      return listPrototypeSets({
        stateDirectory: getProfileUserDataPath(),
        ...(params.worktreeId !== undefined ? { worktreeId: params.worktreeId } : {})
      })
    }
  }),
  defineMethod({
    name: 'prototypes.readFile',
    permission: 'workspace',
    params: ReadPrototypeFileParams,
    handler: async (params, ctx): Promise<ReadPrototypeFileResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const record = host.deps.store.getRecord(params.sessionId)
      if (!record) {
        return { ok: false, error: 'not_found' }
      }
      if (!isLocalStructuredChat(record)) {
        return { ok: false, error: 'unreadable' }
      }
      return readPrototypeSetFile({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        requestId: params.requestId,
        fileName: params.fileName
      })
    }
  })
]
