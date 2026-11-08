import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BrowserWindow } from 'electron'

const ipcEmitter = new EventEmitter()
const ipcMainMock = {
  on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    ipcEmitter.on(channel, listener)
  }),
  removeListener: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    ipcEmitter.removeListener(channel, listener)
  })
}

vi.mock('electron', () => ({
  ipcMain: ipcMainMock
}))

const CHANNELS = {
  requestChannel: 'test:request',
  responseChannel: 'test:response',
  timeoutMs: 1_000
}

type Payload = { host: string }

// SAFETY: the relay reads only isDestroyed, webContents and the EventEmitter methods the fake provides.
const asWindow = (fake: object): BrowserWindow => fake as BrowserWindow

function createWindow(destroyed = false) {
  const webContents = Object.assign(new EventEmitter(), { send: vi.fn() })
  const mainWindow = Object.assign(new EventEmitter(), {
    isDestroyed: () => destroyed,
    webContents
  })
  return { mainWindow, webContents }
}

function requestIdOf(send: Mock): string {
  // SAFETY: the relay's first request payload is { id, ...payload }, so it always carries an id.
  const request = send.mock.calls[0]?.[1] as { id: string }
  return request.id
}

describe('requestFromRenderer', () => {
  beforeEach(() => {
    ipcEmitter.removeAllListeners()
    ipcMainMock.on.mockClear()
    ipcMainMock.removeListener.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the payload under a fresh id and resolves with the matching answer', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const webContents = { send: vi.fn() }
    const mainWindow = { isDestroyed: () => false, webContents }

    const pending = requestFromRenderer<{ value: number }, Payload>(
      asWindow(mainWindow),
      CHANNELS,
      {
        host: 'local'
      }
    )
    const id = requestIdOf(webContents.send)
    expect(webContents.send).toHaveBeenCalledWith(CHANNELS.requestChannel, { id, host: 'local' })
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id, ok: true, result: { value: 7 } }
    )

    await expect(pending).resolves.toEqual({ value: 7 })
  })

  it('ignores answers that carry another request id', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestFromRenderer<{ value: number }, Payload>(
      asWindow(mainWindow),
      CHANNELS,
      {
        host: 'local'
      }
    )
    const id = requestIdOf(webContents.send)
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id: 'other-request', ok: true, result: { value: 1 } }
    )
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id, ok: true, result: { value: 2 } }
    )

    await expect(pending).resolves.toEqual({ value: 2 })
  })

  it('ignores answers from another renderer process', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestFromRenderer<{ value: number }, Payload>(
      asWindow(mainWindow),
      CHANNELS,
      {
        host: 'local'
      }
    )
    const id = requestIdOf(webContents.send)
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: {} },
      { id, ok: true, result: { value: 1 } }
    )
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id, ok: true, result: { value: 2 } }
    )

    await expect(pending).resolves.toEqual({ value: 2 })
  })

  it('rejects with renderer_timeout after the configured timeout and removes its listeners', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()
    vi.useFakeTimers()

    const pending = requestFromRenderer<unknown, Payload>(asWindow(mainWindow), CHANNELS, {
      host: 'local'
    })
    const assertion = expect(pending).rejects.toThrow('renderer_timeout')
    vi.advanceTimersByTime(CHANNELS.timeoutMs - 1)
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(1)
    vi.advanceTimersByTime(1)

    await assertion
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(0)
    expect(webContents.listenerCount('destroyed')).toBe(0)
  })

  it('rejects with renderer_unavailable without sending when the window is already destroyed', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow(true)

    await expect(
      requestFromRenderer(asWindow(mainWindow), CHANNELS, { host: 'local' })
    ).rejects.toThrow('renderer_unavailable')
    expect(webContents.send).not.toHaveBeenCalled()
    expect(ipcMainMock.on).not.toHaveBeenCalled()
  })

  it('rejects with renderer_unavailable when the window closes while a request is pending', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestFromRenderer(asWindow(mainWindow), CHANNELS, { host: 'local' })
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(1)
    mainWindow.emit('closed')

    await expect(pending).rejects.toThrow('renderer_unavailable')
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(0)
    expect(mainWindow.listenerCount('closed')).toBe(0)
    expect(webContents.listenerCount('destroyed')).toBe(0)
    expect(webContents.listenerCount('render-process-gone')).toBe(0)
  })

  it('rejects with renderer_unavailable when sending to the renderer throws', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()
    webContents.send.mockImplementation(() => {
      throw new Error('Object has been destroyed')
    })

    await expect(
      requestFromRenderer(asWindow(mainWindow), CHANNELS, { host: 'local' })
    ).rejects.toThrow('renderer_unavailable')
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(0)
    expect(mainWindow.listenerCount('closed')).toBe(0)
  })

  it('rejects with the renderer error text when the renderer answers ok:false', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestFromRenderer(asWindow(mainWindow), CHANNELS, { host: 'local' })
    const id = requestIdOf(webContents.send)
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id, ok: false, error: 'tab_missing' }
    )

    await expect(pending).rejects.toThrow('tab_missing')
  })

  it('removes every listener once a request settles', async () => {
    const { requestFromRenderer } = await import('./renderer-request-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestFromRenderer<{ value: number }, Payload>(
      asWindow(mainWindow),
      CHANNELS,
      {
        host: 'local'
      }
    )
    ipcEmitter.emit(
      CHANNELS.responseChannel,
      { sender: webContents },
      { id: requestIdOf(webContents.send), ok: true, result: { value: 3 } }
    )

    await expect(pending).resolves.toEqual({ value: 3 })
    expect(ipcMainMock.removeListener).toHaveBeenCalledWith(
      CHANNELS.responseChannel,
      expect.any(Function)
    )
    expect(ipcEmitter.listenerCount(CHANNELS.responseChannel)).toBe(0)
    expect(mainWindow.listenerCount('closed')).toBe(0)
    expect(webContents.listenerCount('destroyed')).toBe(0)
    expect(webContents.listenerCount('render-process-gone')).toBe(0)
  })
})
