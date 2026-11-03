import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  BOT_TEAM_ROOM_ATTACHMENT_FOLDER,
  BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY,
  type BotTeamRoomAttachment
} from '../../../src/shared/bot-team-room-attachments'
import { CLIPBOARD_IMAGE_MAX_BASE64_CHARS } from '../../../src/shared/clipboard-image'
import { startRuntimeCapabilityProbe } from '../transport/runtime-capability-probe'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const READ_TIMEOUT_MS = 15_000
const WRITE_TIMEOUT_MS = 60_000
// Why: enough numbered copies for a folder that already holds several of one name.
const MAX_NAME_ATTEMPTS = 20

const PathExistsReply = z.array(
  z.union([z.object({ exists: z.boolean() }), z.object({ error: z.string() })])
)

export type MobileBotTeamRoomUpload =
  | { kind: 'attached'; attachment: BotTeamRoomAttachment }
  | { kind: 'too-large' }
  | { kind: 'failed' }

/** Whether a host's advertised capabilities let the room attach files. */
export function roomAttachmentsSupported(capabilities: readonly string[]): boolean {
  return capabilities.includes(BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY)
}

/** Whether the connected host takes room attachments; false until its status answers. */
export function useMobileBotTeamRoomAttachSupport(client: RpcClient, enabled: boolean): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setSupported(false)
      return undefined
    }
    return startRuntimeCapabilityProbe(client, (capabilities) =>
      setSupported(roomAttachmentsSupported(capabilities))
    )
  }, [client, enabled])
  return supported
}

/** A file name the team folder can hold: separators and reserved characters become underscores. */
export function safeBotTeamRoomFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '_')
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'file' : cleaned
}

/** `notes.txt` becomes `notes (2).txt` for attempt 2; a name with no extension keeps none. */
function numberedName(name: string, attempt: number): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) {
    return `${name} (${attempt})`
  }
  return `${name.slice(0, dot)} (${attempt})${name.slice(dot)}`
}

/** Whether the path is taken, or null when the host could not say. */
async function pathTaken(
  client: HostClient,
  worktree: string,
  relativePath: string
): Promise<boolean | null> {
  const response = await client.sendRequest(
    'files.pathsExist',
    { worktree, relativePaths: [relativePath] },
    { timeoutMs: READ_TIMEOUT_MS }
  )
  if (!response.ok) {
    return null
  }
  const parsed = PathExistsReply.safeParse(response.result)
  const first = parsed.success ? parsed.data[0] : undefined
  return first !== undefined && 'exists' in first ? first.exists : null
}

/**
 * Writes one picked file into the team folder's attachments folder on the host, under the first
 * name nothing there holds. The host's write never replaces a file, so a taken name is skipped.
 */
export async function uploadMobileBotTeamRoomFile(
  client: HostClient,
  input: { workspaceId: string; name: string; contentBase64: string }
): Promise<MobileBotTeamRoomUpload> {
  if (input.contentBase64.length > CLIPBOARD_IMAGE_MAX_BASE64_CHARS) {
    return { kind: 'too-large' }
  }
  const worktree = `id:${input.workspaceId}`
  const base = safeBotTeamRoomFileName(input.name)
  try {
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
      const name = attempt === 1 ? base : numberedName(base, attempt)
      const relativePath = `${BOT_TEAM_ROOM_ATTACHMENT_FOLDER}/${name}`
      const taken = await pathTaken(client, worktree, relativePath)
      if (taken === null) {
        return { kind: 'failed' }
      }
      if (taken) {
        continue
      }
      const response = await client.sendRequest(
        'files.writeBase64',
        { worktree, relativePath, contentBase64: input.contentBase64 },
        { timeoutMs: WRITE_TIMEOUT_MS }
      )
      return response.ok
        ? { kind: 'attached', attachment: { path: relativePath, name } }
        : { kind: 'failed' }
    }
    return { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
