import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIPBOARD_IMAGE_TOO_LARGE_ERROR } from '../../../src/shared/clipboard-image'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../src/shared/prototype-design-system-view-state'
import { ImageLibraryPermissionError } from '../platform/media-picker-contract'
import type { RpcClient } from '../transport/rpc-client'
import { attachDraftImages } from './mobile-prototype-design-system-images'

const upload = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('../session/mobile-clipboard-image', () => ({
  saveMobileClipboardImageAsTempFile: upload.save
}))

const CLIENT: RpcClient = Object.create(null)

/** A picker that yields the given images, or throws the given error before yielding. */
async function* pickerOf(
  images: readonly { base64: string }[],
  error?: Error
): AsyncGenerator<{ base64: string }> {
  if (error) {
    throw error
  }
  for (const image of images) {
    yield image
  }
}

function stateHolder(): {
  update: (transform: (state: DesignSystemViewState) => DesignSystemViewState) => void
  current: () => DesignSystemViewState
} {
  let state = emptyDesignSystemViewState()
  return {
    update: (transform) => {
      state = transform(state)
    },
    current: () => state
  }
}

beforeEach(() => {
  upload.save.mockReset()
  upload.save.mockResolvedValue('/host/tmp/photo.png')
})

describe('attachDraftImages', () => {
  it('adds each uploaded image to the draft with the path the host saved it at', async () => {
    const holder = stateHolder()
    const onUploadStart = vi.fn()
    const notice = await attachDraftImages({
      client: CLIENT,
      worktreeId: null,
      pickImages: () => pickerOf([{ base64: 'aGk=' }]),
      update: holder.update,
      onUploadStart
    })
    expect(notice).toBeNull()
    expect(onUploadStart).toHaveBeenCalledTimes(1)
    expect(holder.current().images).toEqual([
      expect.objectContaining({ name: 'Image 1', path: '/host/tmp/photo.png' })
    ])
    expect(holder.current().images[0]?.connectionId).toBeUndefined()
  })

  it('attaches nothing and names no failure when the picker is cancelled', async () => {
    const holder = stateHolder()
    const onUploadStart = vi.fn()
    const notice = await attachDraftImages({
      client: CLIENT,
      worktreeId: null,
      pickImages: () => pickerOf([]),
      update: holder.update,
      onUploadStart
    })
    expect(notice).toBeNull()
    expect(onUploadStart).not.toHaveBeenCalled()
    expect(holder.current().images).toEqual([])
  })

  it('keeps the draft and names the refused photo permission', async () => {
    const holder = stateHolder()
    const notice = await attachDraftImages({
      client: CLIENT,
      worktreeId: null,
      pickImages: () => pickerOf([], new ImageLibraryPermissionError()),
      update: holder.update
    })
    expect(notice).toBe('Photo permission denied')
    expect(holder.current().images).toEqual([])
  })

  it('names an image too large to attach and attaches nothing', async () => {
    upload.save.mockRejectedValue(new Error(CLIPBOARD_IMAGE_TOO_LARGE_ERROR))
    const holder = stateHolder()
    const notice = await attachDraftImages({
      client: CLIENT,
      worktreeId: null,
      pickImages: () => pickerOf([{ base64: 'aGk=' }]),
      update: holder.update
    })
    expect(notice).toBe('Image too large to attach')
    expect(holder.current().images).toEqual([])
  })

  it('names any other failed upload as an attach failure', async () => {
    upload.save.mockRejectedValue(new Error('socket closed'))
    const holder = stateHolder()
    const notice = await attachDraftImages({
      client: CLIENT,
      worktreeId: null,
      pickImages: () => pickerOf([{ base64: 'aGk=' }]),
      update: holder.update
    })
    expect(notice).toBe('Attach failed')
  })
})
