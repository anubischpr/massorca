// Attaches images to the Design system draft through the chat composer's own upload: the photo library
// picker and the host save, so the agent reads the file the chat would send.
import { CLIPBOARD_IMAGE_TOO_LARGE_ERROR } from '../../../src/shared/clipboard-image'
import {
  beginDraftImage,
  resolveDraftImage,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import { ImageLibraryPermissionError, type MediaPicker } from '../platform/media-picker-contract'
import { uploadMobileNativeChatImages } from '../session/mobile-native-chat-image-attachment'
import { readMobileWorktreeConnectionId } from '../session/mobile-worktree-connection-id'
import type { RpcClient } from '../transport/rpc-client'

/** What the sheets show and do for the draft's images: the attach action, its spinner and its failure line. */
export type MobileDesignSystemImageControls = {
  attach: () => Promise<void>
  attaching: boolean
  notice: string | null
}

export type DraftImageAttachDeps = {
  client: RpcClient
  /** The worktree of the chat that takes the draft; null when it has none, so the paired host saves. */
  worktreeId: string | null
  pickImages: MediaPicker['pickImages']
  update: (transform: (state: DesignSystemViewState) => DesignSystemViewState) => void
  /** Fired once an image is picked and the upload starts, so the attach spinner covers only the transfer. */
  onUploadStart?: () => void
}

let nextDraftImageId = 0

function addUploadedImage(
  state: DesignSystemViewState,
  path: string,
  connectionId: string | null
): DesignSystemViewState {
  nextDraftImageId += 1
  const id = `draft-image-${nextDraftImageId}`
  const pending = beginDraftImage(state, { id, name: `Image ${state.images.length + 1}` })
  return resolveDraftImage(pending, id, path, connectionId)
}

/**
 * Picks images and adds each uploaded one to the draft. A cancelled picker attaches nothing; a failure
 * attaches nothing and returns the line to show. Resolves to that line, or null when nothing failed.
 */
export async function attachDraftImages(deps: DraftImageAttachDeps): Promise<string | null> {
  const { client, worktreeId, pickImages, update, onUploadStart } = deps
  let connectionId: string | null = null
  try {
    await uploadMobileNativeChatImages('library', {
      client,
      getConnectionId: async () => {
        connectionId =
          worktreeId === null ? null : await readMobileWorktreeConnectionId(client, worktreeId)
        return connectionId
      },
      pickImages,
      ...(onUploadStart ? { onUploadStart } : {}),
      onImageUploaded: (image) =>
        update((state) => addUploadedImage(state, image.path, connectionId))
    })
    return null
  } catch (error) {
    return attachFailureNotice(error)
  }
}

function attachFailureNotice(error: unknown): string {
  if (error instanceof ImageLibraryPermissionError) {
    return 'Photo permission denied'
  }
  if (error instanceof Error && error.message === CLIPBOARD_IMAGE_TOO_LARGE_ERROR) {
    return 'Image too large to attach'
  }
  return 'Attach failed'
}
