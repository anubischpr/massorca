import { nativeChatFileInventoryRead } from '../session/mobile-session-read-operations'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

export type MobileBotTeamFilesResult =
  | { kind: 'ready'; paths: string[] }
  /** A host older than the file listing: the screen says so rather than failing. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

/** The team folder's file paths, read with the same listing the session's @ menu uses. */
export async function listMobileBotTeamFiles(
  client: RpcClient,
  workspaceId: string
): Promise<MobileBotTeamFilesResult> {
  try {
    const response = await nativeChatFileInventoryRead.request(client, {
      worktree: `id:${workspaceId}`
    })
    if (
      !response.ok &&
      isMobileMethodUnavailableError(response.error.code, response.error.message)
    ) {
      return { kind: 'unsupported' }
    }
    const accepted = nativeChatFileInventoryRead.interpret(response)
    return accepted.accepted ? { kind: 'ready', paths: accepted.value } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
