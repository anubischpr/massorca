import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { MarketplaceCatalogAuditRendererResult } from '../../shared/rpc-contract/marketplace-catalog-audit-params'

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

const REQUEST_CHANNEL = 'ui:marketplaceCatalogAuditRequest'
const RESPONSE_CHANNEL = 'ui:marketplaceCatalogAuditResponse'

const ANSWER: MarketplaceCatalogAuditRendererResult = {
  ok: true,
  host: { key: 'runtime:abc', label: 'Runtime abc' },
  rows: []
}

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

describe('requestMarketplaceCatalogAudit', () => {
  beforeEach(() => {
    ipcEmitter.removeAllListeners()
    ipcMainMock.on.mockClear()
    ipcMainMock.removeListener.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the host on the audit request channel and passes the renderer answer through', async () => {
    const { requestMarketplaceCatalogAudit } = await import('./marketplace-catalog-audit-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestMarketplaceCatalogAudit(asWindow(mainWindow), 'runtime:abc')
    const id = requestIdOf(webContents.send)
    expect(webContents.send).toHaveBeenCalledWith(REQUEST_CHANNEL, { id, host: 'runtime:abc' })
    expect(ipcMainMock.on).toHaveBeenCalledWith(RESPONSE_CHANNEL, expect.any(Function))
    ipcEmitter.emit(RESPONSE_CHANNEL, { sender: webContents }, { id, ok: true, result: ANSWER })

    await expect(pending).resolves.toBe(ANSWER)
  })

  it('passes a renderer refusal through unchanged', async () => {
    const { requestMarketplaceCatalogAudit } = await import('./marketplace-catalog-audit-relay')
    const { mainWindow, webContents } = createWindow()
    const refusal: MarketplaceCatalogAuditRendererResult = {
      ok: false,
      reason: 'invalid-host',
      message: 'unknown host'
    }

    const pending = requestMarketplaceCatalogAudit(asWindow(mainWindow), 'ssh:gone')
    ipcEmitter.emit(
      RESPONSE_CHANNEL,
      { sender: webContents },
      { id: requestIdOf(webContents.send), ok: true, result: refusal }
    )

    await expect(pending).resolves.toEqual(refusal)
  })

  it('maps a window that is already gone to no-renderer', async () => {
    const { requestMarketplaceCatalogAudit } = await import('./marketplace-catalog-audit-relay')
    const { mainWindow, webContents } = createWindow(true)

    await expect(requestMarketplaceCatalogAudit(asWindow(mainWindow), 'local')).resolves.toEqual({
      ok: false,
      reason: 'no-renderer'
    })
    expect(webContents.send).not.toHaveBeenCalled()
  })

  it('maps a renderer that never answers to timeout after 90 seconds', async () => {
    const { requestMarketplaceCatalogAudit } = await import('./marketplace-catalog-audit-relay')
    const { mainWindow } = createWindow()
    vi.useFakeTimers()

    const pending = requestMarketplaceCatalogAudit(asWindow(mainWindow), 'local')
    const assertion = expect(pending).resolves.toEqual({ ok: false, reason: 'timeout' })
    vi.advanceTimersByTime(89_999)
    expect(ipcEmitter.listenerCount(RESPONSE_CHANNEL)).toBe(1)
    vi.advanceTimersByTime(1)

    await assertion
    expect(ipcEmitter.listenerCount(RESPONSE_CHANNEL)).toBe(0)
  })

  it('maps a renderer error reply to failed', async () => {
    const { requestMarketplaceCatalogAudit } = await import('./marketplace-catalog-audit-relay')
    const { mainWindow, webContents } = createWindow()

    const pending = requestMarketplaceCatalogAudit(asWindow(mainWindow), 'local')
    ipcEmitter.emit(
      RESPONSE_CHANNEL,
      { sender: webContents },
      { id: requestIdOf(webContents.send), ok: false, error: 'audit crashed' }
    )

    await expect(pending).resolves.toEqual({ ok: false, reason: 'failed' })
  })
})
