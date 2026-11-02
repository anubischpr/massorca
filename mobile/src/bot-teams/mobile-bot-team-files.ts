import { z } from 'zod'
import { nativeChatFileInventoryRead } from '../session/mobile-session-read-operations'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

const READ_TIMEOUT_MS = 15_000
const FileReply = z.object({ content: z.string() })

export type MobileBotTeamFilesResult =
  | { kind: 'ready'; paths: string[] }
  /** A host older than the file listing: the screen says so rather than failing. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export type MobileBotTeamFileResult = { kind: 'ready'; content: string } | { kind: 'failed' }

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

/** One file of the team folder as text; a file the host will not read is failed. */
export async function readMobileBotTeamFile(
  client: RpcClient,
  workspaceId: string,
  relativePath: string
): Promise<MobileBotTeamFileResult> {
  try {
    const response = await client.sendRequest(
      'files.read',
      { worktree: `id:${workspaceId}`, relativePath },
      { timeoutMs: READ_TIMEOUT_MS }
    )
    if (!response.ok) {
      return { kind: 'failed' }
    }
    const parsed = FileReply.safeParse(response.result)
    return parsed.success ? { kind: 'ready', content: parsed.data.content } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
