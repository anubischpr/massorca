import { describeDropSkipReason } from '@/lib/drop-skip-reason-copy'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { userNamedFileAccess } from '@/lib/local-file-access'
import { basename } from '@/lib/path'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { NativeChatChecklistScreenshot } from '../../../../shared/native-chat-checklist'
import { isNativeChatImageAttachmentPath } from './native-chat-image-paste'
import {
  nativeChatAttachFailedNotice,
  nativeChatAttachmentUnreadableNotice,
  nativeChatLocalAttachmentUnsupportedNotice,
  nativeChatWorktreeNotReadyNotice,
  prepareNativeChatSessionAttachmentUpload,
  resolveNativeChatAttachmentOwnerForWorktree,
  resolveNativeChatRuntimeSessionAttachmentOwner,
  uploadNativeChatAttachmentPaths,
  uploadNativeChatSessionAttachmentPaths,
  type NativeChatAttachmentOwner,
  type NativeChatRuntimeSessionAttachmentOwner,
  type NativeChatSshAttachmentOwner
} from './native-chat-attachment-upload'

type AttachmentOwnerState = Parameters<typeof resolveNativeChatAttachmentOwnerForWorktree>[0]

export type NativeChatChecklistScreenshotStore = {
  screenshots: NativeChatChecklistScreenshot[]
  /** What did not attach, said once; null when every file did. */
  notice: string | null
}

/** Who stores a chat's screenshots: its paired server when it runs there, else its worktree's host. */
export function nativeChatChecklistAttachmentOwner(args: {
  target: RuntimeClientTarget
  sessionId: string
  worktreeId: string | null
  state: AttachmentOwnerState
}): NativeChatAttachmentOwner {
  if (args.target.kind === 'environment') {
    return resolveNativeChatRuntimeSessionAttachmentOwner({
      sessionId: args.sessionId,
      runtimeEnvironmentId: args.target.environmentId
    })
  }
  return args.worktreeId
    ? resolveNativeChatAttachmentOwnerForWorktree(args.state, args.worktreeId)
    : { kind: 'not-ready' }
}

/**
 * Stores picked, dropped or pasted image files where the chat's owner keeps attachments, and returns
 * the screenshots an item names. Files that are not images are refused, named in the notice.
 */
export async function storeNativeChatChecklistScreenshots(
  paths: readonly string[],
  owner: NativeChatAttachmentOwner
): Promise<NativeChatChecklistScreenshotStore> {
  const images = paths.filter((path) => isNativeChatImageAttachmentPath(path))
  const refused = paths
    .filter((path) => !isNativeChatImageAttachmentPath(path))
    .map((path) => basename(path))
  const stored = await storeImages(images, owner)
  return {
    screenshots: stored.screenshots,
    notice: refused.length > 0 ? nativeChatAttachFailedNotice(refused, '') : stored.notice
  }
}

async function storeImages(
  paths: string[],
  owner: NativeChatAttachmentOwner
): Promise<NativeChatChecklistScreenshotStore> {
  if (paths.length === 0) {
    return { screenshots: [], notice: null }
  }
  switch (owner.kind) {
    case 'runtime-session':
      return storeOnServer(paths, owner)
    case 'ssh':
      return storeOverSsh(paths, owner)
    case 'local':
      return storeLocally(paths)
    case 'runtime':
      return refusal(nativeChatLocalAttachmentUnsupportedNotice())
    case 'not-ready':
      return refusal(nativeChatWorktreeNotReadyNotice())
  }
}

function refusal(notice: string): NativeChatChecklistScreenshotStore {
  return { screenshots: [], notice }
}

/** Uploads into the chat's store on its paired server, then names what it stored. */
async function storeOnServer(
  paths: string[],
  owner: NativeChatRuntimeSessionAttachmentOwner
): Promise<NativeChatChecklistScreenshotStore> {
  try {
    const prepared = await prepareNativeChatSessionAttachmentUpload(owner)
    if (!prepared.ok) {
      return refusal(prepared.notice)
    }
    const result = await uploadNativeChatSessionAttachmentPaths(paths, prepared.target)
    const uploaded = new Set(result.uploaded.map(({ sourcePath }) => sourcePath))
    const reasons = new Map<string, string>([
      ...result.skipped.map(({ sourcePath, reason }): [string, string] => [
        sourcePath,
        describeDropSkipReason(reason) ?? reason
      ]),
      ...result.failed.map(({ sourcePath, reason }): [string, string] => [sourcePath, reason])
    ])
    return {
      screenshots: result.uploaded.map(({ sourcePath, path }) => ({
        path,
        name: basename(sourcePath)
      })),
      notice: notAttachedNotice(
        paths.filter((path) => !uploaded.has(path)),
        reasons
      )
    }
  } catch (error) {
    return refusal(
      nativeChatAttachFailedNotice(paths.map(basename), extractIpcErrorMessage(error, ''))
    )
  }
}

/** Copies into the worktree's drops folder on the SSH host, then names the remote paths. */
async function storeOverSsh(
  paths: string[],
  owner: NativeChatSshAttachmentOwner
): Promise<NativeChatChecklistScreenshotStore> {
  const remotePaths = await uploadNativeChatAttachmentPaths(paths, owner)
  if (!remotePaths || remotePaths.length === 0) {
    return refusal(nativeChatAttachmentUnreadableNotice())
  }
  return {
    screenshots: remotePaths.map((path) => ({ path, name: basename(path) })),
    notice: null
  }
}

/** A local chat's agent reads this machine's files directly, so each readable path stands as it is. */
async function storeLocally(paths: string[]): Promise<NativeChatChecklistScreenshotStore> {
  const screenshots: NativeChatChecklistScreenshot[] = []
  const unreadable: string[] = []
  for (const path of paths) {
    try {
      await window.api.fs.stat({ filePath: path, access: userNamedFileAccess() })
      screenshots.push({ path, name: basename(path) })
    } catch {
      unreadable.push(basename(path))
    }
  }
  return {
    screenshots,
    notice: unreadable.length > 0 ? nativeChatAttachFailedNotice(unreadable, '') : null
  }
}

/** One notice for the files that did not attach; a cause every file shares is said once. */
function notAttachedNotice(paths: string[], reasons: Map<string, string>): string | null {
  if (paths.length === 0) {
    return null
  }
  const causes = paths.map((path) => reasons.get(path) ?? '')
  const shared = causes.every((cause) => cause === causes[0]) ? causes[0] : ''
  return nativeChatAttachFailedNotice(
    paths.map((path) => basename(path)),
    shared
  )
}
