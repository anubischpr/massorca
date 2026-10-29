import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOTYPE_CAPTURE_RECT_CHANNEL } from '../../shared/prototype-capture-types'
import { PROTOTYPE_ATTACHMENT_MAX_BYTES } from '../../shared/rpc-contract/prototype-params'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }
  }
}))

import { registerPrototypeCaptureHandlers } from './prototype-capture'

const RECT = { x: 10, y: 20, width: 300, height: 200 }

type FakeImage = { isEmpty: () => boolean; toPNG: () => Buffer }

function senderWith(capture: (rect: unknown) => Promise<FakeImage>) {
  const capturePage = vi.fn(capture)
  return { sender: { capturePage }, capturePage }
}

function imageOf(png: Buffer, empty = false): FakeImage {
  return { isEmpty: () => empty, toPNG: () => png }
}

async function captureWith(rect: unknown, sender: unknown): Promise<unknown> {
  const handler = mocks.handlers.get(PROTOTYPE_CAPTURE_RECT_CHANNEL)
  if (!handler) {
    throw new Error('capture handler not registered')
  }
  return handler({ sender }, rect)
}

beforeEach(() => {
  mocks.handlers.clear()
  registerPrototypeCaptureHandlers()
})

describe('prototypeCapture:captureRect', () => {
  it('captures the rectangle of the calling window and returns its PNG as base64', async () => {
    const png = Buffer.from('png-bytes')
    const { sender, capturePage } = senderWith(async () => imageOf(png))

    expect(await captureWith(RECT, sender)).toEqual({ ok: true, pngBase64: png.toString('base64') })
    expect(capturePage).toHaveBeenCalledWith(RECT)
  })

  it('rounds the rectangle to whole pixels with a non-negative origin', async () => {
    const { sender, capturePage } = senderWith(async () => imageOf(Buffer.from('p')))

    await captureWith({ x: -5.7, y: 3.9, width: 120.8, height: 40.2 }, sender)
    expect(capturePage).toHaveBeenCalledWith({ x: 0, y: 3, width: 120, height: 40 })
  })

  it.each([
    ['no rectangle', null],
    ['a string', 'rect'],
    ['a NaN origin', { x: Number.NaN, y: 0, width: 10, height: 10 }],
    ['an infinite width', { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 }],
    ['a width under one pixel', { x: 0, y: 0, width: 0.5, height: 10 }],
    ['a width over 4000', { x: 0, y: 0, width: 4001, height: 10 }],
    ['a height over 4000', { x: 0, y: 0, width: 10, height: 4001 }]
  ])('refuses %s without capturing', async (_label, rect) => {
    const { sender, capturePage } = senderWith(async () => imageOf(Buffer.from('p')))

    expect(await captureWith(rect, sender)).toEqual({ ok: false, error: 'unavailable' })
    expect(capturePage).not.toHaveBeenCalled()
  })

  it('answers unavailable for an empty capture', async () => {
    const { sender } = senderWith(async () => imageOf(Buffer.alloc(0), true))

    expect(await captureWith(RECT, sender)).toEqual({ ok: false, error: 'unavailable' })
  })

  it('answers too_large for a PNG over the attachment cap, and keeps one of exactly the cap', async () => {
    const over = senderWith(async () => imageOf(Buffer.alloc(PROTOTYPE_ATTACHMENT_MAX_BYTES + 1)))
    expect(await captureWith(RECT, over.sender)).toEqual({ ok: false, error: 'too_large' })

    const exact = senderWith(async () => imageOf(Buffer.alloc(PROTOTYPE_ATTACHMENT_MAX_BYTES)))
    expect(await captureWith(RECT, exact.sender)).toMatchObject({ ok: true })
  })

  it('answers unavailable when the capture throws', async () => {
    const { sender } = senderWith(async () => {
      throw new Error('window closed')
    })

    expect(await captureWith(RECT, sender)).toEqual({ ok: false, error: 'unavailable' })
  })
})
