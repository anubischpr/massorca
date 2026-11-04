// `prototypes.*` for a chat's design system: read it, list its saved versions, open one read-only, and restore one.
// The host reads the project from the chat's record; a client names a chat and a version, never a path.

import {
  ListDesignSystemVersionsParams,
  ReadDesignSystemVersionParams,
  ReadPrototypeDesignSystemParams,
  RestoreDesignSystemVersionParams,
  type ListDesignSystemVersionsResult,
  type ReadDesignSystemVersionResult,
  type ReadPrototypeDesignSystemResult,
  type RestoreDesignSystemVersionResult
} from '../../../../shared/rpc-contract/prototype-params'
import { projectDirectoryOfChat } from '../../../native-chat/chat-launch-directory'
import { readDesignSystemOfLaunchDirectory } from '../../../native-chat/prototype-design-system-files'
import {
  keepDesignSystemVersionOfLaunchDirectory,
  listDesignSystemVersionsOfLaunchDirectory,
  readDesignSystemVersionOfLaunchDirectory,
  restoreDesignSystemVersionOfLaunchDirectory
} from '../../../native-chat/prototype-design-system-versions'
import { getProfileUserDataPath } from '../../../orca-profiles/profile-storage-paths'
import { defineMethod, type RpcContext } from '../core'
import {
  isLocalStructuredChat,
  isOwnerCaller,
  isRequestVisibleToGuest,
  logPrototypeRefusal,
  type InstalledHost
} from './prototype-chat-access'
import { requireInstalledStructuredHost } from './structured-agent-session-gate'

/**
 * The project directory a design system is read from, for a local chat this host keeps. A chat that is not local,
 * or has no directory, is refused and logged under the method that asked.
 */
async function localLaunchDirectoryOf(
  host: InstalledHost,
  ctx: RpcContext,
  method: string,
  sessionId: string
): Promise<string | undefined> {
  const record = host.deps.store.getRecord(sessionId)
  // Why the record: a client names a chat, and the host derives the project root from its launch directory.
  const launchDirectory =
    record && isLocalStructuredChat(record)
      ? await projectDirectoryOfChat(record, host.deps.resolveWorkspacePath, async (workspaceId) =>
          ctx.runtime.resolveWorkspaceRepositoryPath(workspaceId)
        )
      : undefined
  if (launchDirectory === undefined) {
    logPrototypeRefusal(method, sessionId, 'chat is not local or has no launch directory')
  }
  return launchDirectory
}

export const DESIGN_SYSTEM_PROTOTYPE_METHODS = [
  defineMethod({
    name: 'prototypes.readDesignSystem',
    permission: 'workspace',
    params: ReadPrototypeDesignSystemParams,
    handler: async (params, ctx): Promise<ReadPrototypeDesignSystemResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const launchDirectory = await localLaunchDirectoryOf(
        host,
        ctx,
        'prototypes.readDesignSystem',
        params.sessionId
      )
      if (launchDirectory === undefined) {
        return { ok: false, error: 'not_found' }
      }
      // Why before the read: the version this read shows is then one the host can open later.
      await keepDesignSystemVersionOfLaunchDirectory(getProfileUserDataPath(), launchDirectory)
      return readDesignSystemOfLaunchDirectory(launchDirectory)
    }
  }),
  defineMethod({
    name: 'prototypes.listDesignSystemVersions',
    permission: 'workspace',
    params: ListDesignSystemVersionsParams,
    handler: async (params, ctx): Promise<ListDesignSystemVersionsResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const launchDirectory = await localLaunchDirectoryOf(
        host,
        ctx,
        'prototypes.listDesignSystemVersions',
        params.sessionId
      )
      if (launchDirectory === undefined) {
        return { ok: false, error: 'not_found' }
      }
      return listDesignSystemVersionsOfLaunchDirectory({
        stateDirectory: getProfileUserDataPath(),
        launchDirectory
      })
    }
  }),
  defineMethod({
    name: 'prototypes.readDesignSystemVersion',
    permission: 'workspace',
    params: ReadDesignSystemVersionParams,
    handler: async (params, ctx): Promise<ReadDesignSystemVersionResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const launchDirectory = await localLaunchDirectoryOf(
        host,
        ctx,
        'prototypes.readDesignSystemVersion',
        params.sessionId
      )
      if (launchDirectory === undefined) {
        return { ok: false, error: 'not_found' }
      }
      return readDesignSystemVersionOfLaunchDirectory({
        stateDirectory: getProfileUserDataPath(),
        launchDirectory,
        version: params.version
      })
    }
  }),
  defineMethod({
    name: 'prototypes.restoreDesignSystemVersion',
    permission: 'workspace',
    params: RestoreDesignSystemVersionParams,
    handler: async (params, ctx): Promise<RestoreDesignSystemVersionResult> => {
      const host = await requireInstalledStructuredHost(ctx)
      const launchDirectory = await localLaunchDirectoryOf(
        host,
        ctx,
        'prototypes.restoreDesignSystemVersion',
        params.sessionId
      )
      if (launchDirectory === undefined) {
        return { ok: false, error: 'not_found' }
      }
      const owner = isOwnerCaller(ctx)
      const record = host.deps.store.getRecord(params.sessionId)
      // Why the same rule as prototypes.restoreVersion: a guest may change the local chats it can list.
      return restoreDesignSystemVersionOfLaunchDirectory({
        stateDirectory: getProfileUserDataPath(),
        launchDirectory,
        version: params.version,
        canAct: () => owner || isRequestVisibleToGuest(record, false)
      })
    }
  })
]
