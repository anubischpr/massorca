import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import {
  MAX_THUMBNAIL_READ_ATTEMPTS,
  THUMBNAIL_READ_RETRY_DELAY_MS,
  useMobilePrototypeThumbnailHtml
} from './use-mobile-prototype-thumbnail'

// Each read is answered by the test, in the order it asks.
const readMock = vi.hoisted(() => vi.fn())

vi.mock('../session/mobile-prototype-host-rpc', () => ({
  readMobilePrototypeFile: readMock
}))

// The read is mocked, so the client is only an identity the hook passes along.
const CLIENT: RpcClient = {
  sendRequest: () => Promise.reject(new Error('the read is mocked')),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: () => {},
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => null,
  onStateChange: () => () => {},
  notifyForeground: () => {},
  close: () => {}
}

const FILE = { sessionId: 'session-1', requestId: 'request-1', fileName: 'direction-c.html' }

const seen: { html: string | null } = { html: null }

function Card({ active }: { active: boolean }) {
  seen.html = useMobilePrototypeThumbnailHtml(CLIENT, FILE, active)
  return null
}

/** Runs the timers for `ms`, then lets the effects and the reads they start settle. */
async function passTime(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await act(async () => {})
}

describe('the thumbnail of a set card', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    readMock.mockReset()
    seen.html = null
  })

  afterEach(() => {
    act(() => {
      renderer?.unmount()
    })
    renderer = undefined
    vi.useRealTimers()
  })

  function mountCard(): void {
    act(() => {
      renderer = create(createElement(Card, { active: true }))
    })
  }

  it('asks again after a read the host gave no answer to, and draws the page once it answers', async () => {
    readMock
      .mockResolvedValueOnce({ kind: 'unreachable' })
      .mockResolvedValueOnce({ kind: 'ready', html: '<p>Direction C</p>' })
    mountCard()
    await passTime(0)
    expect(readMock).toHaveBeenCalledTimes(1)
    expect(seen.html).toBeNull()

    await passTime(THUMBNAIL_READ_RETRY_DELAY_MS)
    expect(readMock).toHaveBeenCalledTimes(2)
    expect(seen.html).toBe('<p>Direction C</p>')
  })

  it('stops asking after a bounded number of tries when the host never answers', async () => {
    readMock.mockResolvedValue({ kind: 'unreachable' })
    mountCard()
    for (let attempt = 0; attempt < MAX_THUMBNAIL_READ_ATTEMPTS + 2; attempt += 1) {
      await passTime(THUMBNAIL_READ_RETRY_DELAY_MS)
    }
    expect(readMock).toHaveBeenCalledTimes(MAX_THUMBNAIL_READ_ATTEMPTS)
    expect(seen.html).toBeNull()
  })

  it('does not ask again once the host has refused the file', async () => {
    readMock.mockResolvedValue({ kind: 'refused', error: 'not_found' })
    mountCard()
    await passTime(THUMBNAIL_READ_RETRY_DELAY_MS * MAX_THUMBNAIL_READ_ATTEMPTS)
    expect(readMock).toHaveBeenCalledTimes(1)
    expect(seen.html).toBeNull()
  })
})
