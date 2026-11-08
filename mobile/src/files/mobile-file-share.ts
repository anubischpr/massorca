import { mobileFileMediaMime } from './mobile-file-media'
import { downloadMobileFileMedia } from './mobile-file-media-download'
import type { MobileFilePreviewRpcSender } from './mobile-file-preview-operations'

export type MobileFileShareTarget = { worktreeId: string; relativePath: string }

/**
 * Copies one file of a worktree to the phone's cache through the media download path, then opens
 * the system share sheet with that copy. Any file type works; sharing is checked before downloading.
 */
export async function shareMobileFile(
  client: MobileFilePreviewRpcSender,
  target: MobileFileShareTarget,
  dialogTitle: string
): Promise<'shared' | 'unavailable'> {
  // Why: the native modules load only on press, so screens that never share can import this file in tests.
  const Sharing = await import('expo-sharing')
  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable'
  }
  const { createMobileMediaSink } = await import('./mobile-media-preview-cache')
  const mimeType = mobileFileMediaMime(target.relativePath) ?? 'application/octet-stream'
  const uri = await downloadMobileFileMedia(
    client,
    { ...target, mimeType },
    createMobileMediaSink(target.relativePath, mimeType),
    new AbortController().signal,
    () => undefined
  )
  await Sharing.shareAsync(uri, { mimeType, dialogTitle })
  return 'shared'
}
