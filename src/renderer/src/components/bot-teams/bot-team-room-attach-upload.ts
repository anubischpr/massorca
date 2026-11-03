import { userNamedFileAccess } from '@/lib/local-file-access'
import { basename, joinPath } from '@/lib/path'
import { importExternalPathsToRuntime } from '@/runtime/runtime-file-import-client'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'
import { findKnownWorktreeById } from '@/store/slices/worktrees/listing/detected-worktree-meta'
import {
  BOT_TEAM_ROOM_ATTACHMENT_FOLDER,
  BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY,
  type BotTeamRoomAttachment
} from '../../../../shared/bot-team-room-attachments'
import { toRuntimeExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import type { RuntimeStatus } from '../../../../shared/runtime-types'
import { BOT_TEAM_LOCAL_HOST } from '../../runtime/bot-team-host'

export type BotTeamRoomAttachFailure = { sourcePath: string; reason: string }

/** The team folder's path on the host it lives on, or null while this window does not know it yet. */
export function botTeamFolderPathOnHost(workspaceId: string, host: string): string | null {
  const executionHostId: ExecutionHostId =
    host === BOT_TEAM_LOCAL_HOST ? 'local' : toRuntimeExecutionHostId(host)
  return findKnownWorktreeById(useAppStore.getState(), workspaceId, executionHostId)?.path ?? null
}

/** Whether the team's host takes files in its room: this computer always does, a paired server must advertise it. */
export async function botTeamRoomAttachmentsSupported(host: string): Promise<boolean> {
  if (host === BOT_TEAM_LOCAL_HOST) {
    return true
  }
  try {
    const status = await callRuntimeRpc<RuntimeStatus>(
      { kind: 'environment', environmentId: host },
      'status.get',
      undefined,
      { timeoutMs: 15_000 }
    )
    return status.capabilities?.includes(BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY) === true
  } catch {
    return false
  }
}

/**
 * Copies picked files into the team folder's attachments folder on the team's host, through the same
 * import the Workspaces composer uses, so a paired server receives them too.
 */
export async function attachBotTeamRoomFiles(args: {
  host: string
  workspaceId: string
  sourcePaths: string[]
}): Promise<{ attachments: BotTeamRoomAttachment[]; failed: BotTeamRoomAttachFailure[] }> {
  const folderPath = botTeamFolderPathOnHost(args.workspaceId, args.host)
  if (folderPath === null) {
    throw new Error('The team folder is not ready on its host yet.')
  }
  const { results } = await importExternalPathsToRuntime(
    {
      settings: {
        activeRuntimeEnvironmentId: args.host === BOT_TEAM_LOCAL_HOST ? null : args.host
      },
      worktreeId: args.workspaceId,
      worktreePath: folderPath
    },
    args.sourcePaths,
    joinPath(folderPath, BOT_TEAM_ROOM_ATTACHMENT_FOLDER),
    { ensureDestinationDir: true, access: userNamedFileAccess() }
  )
  const attachments: BotTeamRoomAttachment[] = []
  const failed: BotTeamRoomAttachFailure[] = []
  for (const result of results) {
    if (result.status === 'imported' && result.kind === 'file') {
      const name = basename(result.destPath)
      attachments.push({ path: `${BOT_TEAM_ROOM_ATTACHMENT_FOLDER}/${name}`, name })
    } else if (result.status === 'imported') {
      failed.push({ sourcePath: result.sourcePath, reason: 'Folders cannot be attached.' })
    } else {
      failed.push({ sourcePath: result.sourcePath, reason: result.reason })
    }
  }
  return { attachments, failed }
}
