import { randomUUID } from 'node:crypto'

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'

export type RendererRequestChannels = {
  requestChannel: string
  responseChannel: string
  timeoutMs: number
}

type RendererRequestResponse<TResult> =
  | { id: string; ok: true; result: TResult }
  | { id: string; ok: false; error: string }

// Why: an answer settles the request only when its sender and request id both match this request.
export async function requestFromRenderer<TResult, TPayload extends object>(
  mainWindow: BrowserWindow,
  channels: RendererRequestChannels,
  payload: TPayload
): Promise<TResult> {
  if (mainWindow.isDestroyed()) {
    throw new Error('renderer_unavailable')
  }
  const webContents = mainWindow.webContents
  const id = randomUUID()
  return await new Promise((resolve, reject) => {
    let settled = false
    const onRendererUnavailable = (): void => finish(new Error('renderer_unavailable'))
    const finish = (error?: Error, result?: TResult): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      ipcMain.removeListener(channels.responseChannel, onResponse)
      if (typeof mainWindow.removeListener === 'function') {
        mainWindow.removeListener('closed', onRendererUnavailable)
      }
      if (typeof webContents.removeListener === 'function') {
        webContents.removeListener('destroyed', onRendererUnavailable)
        webContents.removeListener('render-process-gone', onRendererUnavailable)
      }
      if (error) {
        reject(error)
      } else if (result) {
        resolve(result)
      } else {
        reject(new Error('renderer_unavailable'))
      }
    }
    const timeout = setTimeout(() => finish(new Error('renderer_timeout')), channels.timeoutMs)
    const onResponse = (
      event: Electron.IpcMainEvent,
      response: RendererRequestResponse<TResult>
    ): void => {
      if (event.sender !== webContents) {
        return
      }
      if (response.id !== id) {
        return
      }
      if (response.ok) {
        finish(undefined, response.result)
      } else {
        finish(new Error(response.error))
      }
    }
    ipcMain.on(channels.responseChannel, onResponse)
    if (typeof mainWindow.once === 'function') {
      mainWindow.once('closed', onRendererUnavailable)
    }
    if (typeof webContents.once === 'function') {
      webContents.once('destroyed', onRendererUnavailable)
      webContents.once('render-process-gone', onRendererUnavailable)
    }
    try {
      webContents.send(channels.requestChannel, { id, ...payload })
    } catch {
      finish(new Error('renderer_unavailable'))
    }
  })
}
