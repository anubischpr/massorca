import type { View } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureRef = vi.fn<(...args: unknown[]) => Promise<string>>()
const crop = vi.fn()
const resize = vi.fn()
const releaseContext = vi.fn()
const releaseRendered = vi.fn()
const saveAsync = vi.fn<(...args: unknown[]) => Promise<{ uri: string; base64?: string }>>()
const renderAsync = vi.fn<() => Promise<unknown>>()
const manipulate = vi.fn<(uri: string) => unknown>()
const deleted: string[] = []

vi.mock('react-native', () => ({ PixelRatio: { get: () => 2 } }))
vi.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => captureRef(...args)
}))
vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (uri: string) => manipulate(uri) },
  SaveFormat: { PNG: 'png' }
}))
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(private readonly uri: string) {}
    delete(): void {
      deleted.push(this.uri)
    }
  }
}))

import { capturePrototypePin } from './mobile-prototype-capture'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: A stand-in for a mounted View; the mocked capture only passes it through.
const FRAME_VIEW = { current: {} as View }

function input(rect = { x: 10, y: 20, width: 120, height: 40 }) {
  return { frame: FRAME_VIEW, frameSize: { width: 360, height: 640 }, scale: 1, rect }
}

describe('capturePrototypePin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleted.length = 0
    captureRef.mockResolvedValue('file:///cache/frame.png')
    manipulate.mockReturnValue({ crop, resize, renderAsync, release: releaseContext })
    renderAsync.mockResolvedValue({ saveAsync, release: releaseRendered })
    saveAsync.mockResolvedValue({ uri: 'file:///cache/pin.png', base64: 'iVBORw0KGgo=' })
  })

  it('photographs the frame in pixels, crops it to the element and returns the PNG', async () => {
    const result = await capturePrototypePin(input())

    expect(result).toEqual({ ok: true, pngBase64: 'iVBORw0KGgo=' })
    expect(captureRef).toHaveBeenCalledWith(
      FRAME_VIEW.current,
      expect.objectContaining({ format: 'png', result: 'tmpfile', width: 720, height: 1280 })
    )
    expect(manipulate).toHaveBeenCalledWith('file:///cache/frame.png')
    expect(crop).toHaveBeenCalledWith({ originX: 20, originY: 40, width: 240, height: 80 })
    expect(resize).not.toHaveBeenCalled()
  })

  it('shrinks a large element so it still fits the upload', async () => {
    await capturePrototypePin({
      ...input({ x: 0, y: 0, width: 650, height: 200 }),
      frameSize: { width: 700, height: 640 }
    })
    expect(resize).toHaveBeenCalledWith({ width: 1200 })
  })

  it('cleans up its pictures and releases both handles, success or not', async () => {
    await capturePrototypePin(input())
    expect(deleted.sort()).toEqual(['file:///cache/frame.png', 'file:///cache/pin.png'])
    expect(releaseContext).toHaveBeenCalledTimes(1)
    expect(releaseRendered).toHaveBeenCalledTimes(1)
  })

  it('is no screenshot when the picture cannot be taken', async () => {
    captureRef.mockRejectedValue(new Error('blank'))
    expect(await capturePrototypePin(input())).toEqual({ ok: false })
    expect(manipulate).not.toHaveBeenCalled()
  })

  it('is no screenshot when the crop or the encoding fails', async () => {
    renderAsync.mockRejectedValue(new Error('decode'))
    expect(await capturePrototypePin(input())).toEqual({ ok: false })
    expect(deleted).toEqual(['file:///cache/frame.png'])
    renderAsync.mockResolvedValue({ saveAsync, release: releaseRendered })
    saveAsync.mockResolvedValue({ uri: 'file:///cache/pin.png' })
    expect(await capturePrototypePin(input())).toEqual({ ok: false })
  })

  it('takes nothing for a frame that is not on screen or an element outside it', async () => {
    expect(await capturePrototypePin({ ...input(), frame: { current: null } })).toEqual({
      ok: false
    })
    expect(await capturePrototypePin(input({ x: 900, y: 0, width: 20, height: 20 }))).toEqual({
      ok: false
    })
    expect(captureRef).not.toHaveBeenCalled()
  })
})
