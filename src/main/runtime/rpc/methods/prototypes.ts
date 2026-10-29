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
  WriteAttachmentParams,
  type CreatePrototypeRequestResult,
  type ListPrototypeSetsResult,
  type ReadPrototypeFileResult,
  type WriteAttachmentResult
} from '../../../../shared/rpc-contract/prototype-params'
import {
  createPrototypeRequest,
  listPrototypeSets,
  readPrototypeSetFile,
  writePrototypeAttachment
} from '../../../native-chat/prototype-requests'
import { getProfileUserDataPath } from '../../../orca-profiles/profile-storage-paths'
import { defineMethod } from '../core'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

/** Structured chats run on their owning runtime's own filesystem; any other location has no folder here. */
function isLocalStructuredChat(record: Pick<AgentSessionRecord, 'location'>): boolean {
  return record.location.executionHostId === LOCAL_EXECUTION_HOST_ID && !record.location.wslDistro
}

/** A chat this host keeps as a local structured chat; a missing record has no folder here. */
function isLocalChatRecord(
  record: Pick<AgentSessionRecord, 'location'> | null | undefined
): boolean {
  return record ? isLocalStructuredChat(record) : false
}

/** One line for a refusal the client reads as "no prototype capture", so a silent send is traceable. */
function logPrototypeRefusal(method: string, sessionId: string, reason: string): void {
  console.warn(`[prototypes] ${method} refused for chat ${sessionId}: ${reason}`)
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
        logPrototypeRefusal(
          'prototypes.createRequest',
          params.sessionId,
          record ? 'chat is not local to this runtime' : 'no record of this chat on this runtime'
        )
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
      const host = await requireInstalledStructuredHost(ctx)
      // Why: this desktop and its CLI, the owner, list every folder on the host. Any other caller, one that
      // names no identity included, lists only the chats this host still keeps, as its chat list does.
      const owner = ctx.caller?.kind === 'desktop' || ctx.caller?.kind === 'local-cli'
      return listPrototypeSets({
        stateDirectory: getProfileUserDataPath(),
        ...(params.worktreeId !== undefined ? { worktreeId: params.worktreeId } : {}),
        launchDirectoryOf: (sessionId: string) =>
          host.deps.store.getRecord(sessionId)?.launchDirectory,
        ...(owner
          ? {}
          : {
              isChatListed: (sessionId: string): boolean =>
                isLocalChatRecord(host.deps.store.getRecord(sessionId))
            })
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
        logPrototypeRefusal('prototypes.readFile', params.sessionId, 'no record of this chat')
        return { ok: false, error: 'not_found' }
      }
      if (!isLocalStructuredChat(record)) {
        logPrototypeRefusal('prototypes.readFile', params.sessionId, 'chat is not local')
        return { ok: false, error: 'not_found' }
      }
      return readPrototypeSetFile({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        requestId: params.requestId,
        fileName: params.fileName,
        launchDirectory: record.launchDirectory
      })
    }
  }),
  defineMethod({
    name: 'prototypes.writeAttachment',
    permission: 'workspace',
    params: WriteAttachmentParams,
    handler: async (params, ctx): Promise<WriteAttachmentResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const record = host.deps.store.getRecord(params.sessionId)
      if (!record || !isLocalStructuredChat(record)) {
        logPrototypeRefusal('prototypes.writeAttachment', params.sessionId, 'chat is not local')
        return { ok: false, error: 'unsupported' }
      }
      return writePrototypeAttachment({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        requestId: params.requestId,
        name: params.name,
        pngBase64: params.pngBase64
      })
    }
  })
]
