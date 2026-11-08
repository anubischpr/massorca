// `prototypes.*`: the prototype requests a chat's agent writes, kept by the host beside the chat.
//
// Additive: an older host answers `method_not_found`, which a client reads as "unsupported". The
// host resolves every folder from its own state directory and the chat's record; a client names a
// session, a request id or a file name, never a path.

import {
  CreatePrototypeRequestParams,
  ListPrototypeSetsParams,
  PrototypeRequestTargetParams,
  ReadPrototypeFileParams,
  RestorePrototypeVersionParams,
  WriteAttachmentParams,
  type ArchivePrototypeRequestResult,
  type CreatePrototypeRequestResult,
  type DeletePrototypeRequestResult,
  type ListPrototypeSetsResult,
  type ReadPrototypeFileResult,
  type RestorePrototypeVersionResult,
  type WriteAttachmentResult
} from '../../../../shared/rpc-contract/prototype-params'
import { restorePrototypeVersion } from '../../../native-chat/prototype-version-restore'
import {
  launchDirectoryOfChat,
  projectDirectoryOfChat
} from '../../../native-chat/chat-launch-directory'
import { isLocalChatWorkingDirectoryGone } from '../../../native-chat/prototype-request-deletability'
import {
  deletePrototypeRequest,
  setPrototypeRequestArchived
} from '../../../native-chat/prototype-request-lifecycle'
import {
  createPrototypeRequest,
  listPrototypeSets,
  readPrototypeSetFile,
  writePrototypeAttachment
} from '../../../native-chat/prototype-requests'
import { getProfileUserDataPath } from '../../../orca-profiles/profile-storage-paths'
import { defineMethod, type RpcContext } from '../core'
import {
  isLocalStructuredChat,
  isOwnerCaller,
  isRequestVisibleToGuest,
  listedHostChatsOf,
  logPrototypeRefusal,
  type InstalledHost
} from './prototype-chat-access'
import { DESIGN_SYSTEM_PROTOTYPE_METHODS } from './prototype-design-system-methods'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

/** The host decides: a request is deletable when its chat record is gone, or its local chat's directory is. */
async function isRequestDeletable(host: InstalledHost, sessionId: string): Promise<boolean> {
  const record = host.deps.store.getRecord(sessionId)
  if (!record) {
    return true
  }
  // Why local only: a remote chat out of contact has no readable directory here, and that is not a deletion.
  return isLocalStructuredChat(record)
    ? isLocalChatWorkingDirectoryGone(record, host.deps.resolveWorkspacePath)
    : false
}

async function archivePrototypeRequest(
  params: PrototypeRequestTargetParams,
  ctx: RpcContext,
  archived: boolean
): Promise<ArchivePrototypeRequestResult> {
  const host = await requireInstalledStructuredHost(ctx)
  const owner = isOwnerCaller(ctx)
  return setPrototypeRequestArchived({
    stateDirectory: getProfileUserDataPath(),
    sessionId: params.sessionId,
    requestId: params.requestId,
    archived,
    canAct: (manifest) =>
      owner ||
      isRequestVisibleToGuest(
        host.deps.store.getRecord(params.sessionId),
        manifest.archived === true
      )
  })
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
        launchDirectory: await launchDirectoryOfChat(record, host.deps.resolveWorkspacePath),
        request: params,
        generateTitle: ctx.runtime.prototypeSetTitles(),
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
      const owner = isOwnerCaller(ctx)
      return listPrototypeSets({
        stateDirectory: getProfileUserDataPath(),
        ...(params.worktreeId !== undefined ? { worktreeId: params.worktreeId } : {}),
        launchDirectoryOf: async (sessionId: string) => {
          const record = host.deps.store.getRecord(sessionId)
          // Why the repository fallback: a removed worktree no longer resolves, and its project must not vanish.
          return record && isLocalStructuredChat(record)
            ? projectDirectoryOfChat(record, host.deps.resolveWorkspacePath, async (workspaceId) =>
                ctx.runtime.resolveWorkspaceRepositoryPath(workspaceId)
              )
            : undefined
        },
        // Why no chats under a worktree filter: a chat record names its workspace, not the worktree a request names.
        ...(params.worktreeId === undefined
          ? { hostChats: () => listedHostChatsOf(host.deps.store.listRecords()) }
          : {}),
        isDeletable: (sessionId: string) => isRequestDeletable(host, sessionId),
        ...(owner
          ? {}
          : {
              isChatListed: (sessionId: string, archived: boolean): boolean =>
                isRequestVisibleToGuest(host.deps.store.getRecord(sessionId), archived)
            })
      })
    }
  }),
  defineMethod({
    name: 'prototypes.archive',
    permission: 'workspace',
    params: PrototypeRequestTargetParams,
    handler: (params, ctx): Promise<ArchivePrototypeRequestResult> =>
      archivePrototypeRequest(params, ctx, true)
  }),
  defineMethod({
    name: 'prototypes.unarchive',
    permission: 'workspace',
    params: PrototypeRequestTargetParams,
    handler: (params, ctx): Promise<ArchivePrototypeRequestResult> =>
      archivePrototypeRequest(params, ctx, false)
  }),
  defineMethod({
    name: 'prototypes.delete',
    permission: 'workspace',
    params: PrototypeRequestTargetParams,
    handler: async (params, ctx): Promise<DeletePrototypeRequestResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const owner = isOwnerCaller(ctx)
      return deletePrototypeRequest({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        requestId: params.requestId,
        canAct: (manifest) =>
          owner ||
          isRequestVisibleToGuest(
            host.deps.store.getRecord(params.sessionId),
            manifest.archived === true
          ),
        isDeletable: () => isRequestDeletable(host, params.sessionId)
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
        launchDirectory: await launchDirectoryOfChat(record, host.deps.resolveWorkspacePath)
      })
    }
  }),
  defineMethod({
    name: 'prototypes.restoreVersion',
    permission: 'workspace',
    params: RestorePrototypeVersionParams,
    handler: async (params, ctx): Promise<RestorePrototypeVersionResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const owner = isOwnerCaller(ctx)
      return restorePrototypeVersion({
        stateDirectory: getProfileUserDataPath(),
        sessionId: params.sessionId,
        requestId: params.requestId,
        letter: params.letter,
        version: params.version,
        canAct: (manifest) =>
          owner ||
          isRequestVisibleToGuest(
            host.deps.store.getRecord(params.sessionId),
            manifest.archived === true
          )
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
  }),
  ...DESIGN_SYSTEM_PROTOTYPE_METHODS
]
