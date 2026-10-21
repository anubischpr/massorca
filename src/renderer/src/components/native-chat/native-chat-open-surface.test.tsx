// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  requestNativeChatOpenSurface,
  useNativeChatOpenSurfaceRequests
} from './native-chat-open-surface'

describe('requests for a chat surface to open', () => {
  it('opens the surface that is mounted when the request is made', () => {
    const open = vi.fn()
    renderHook(() => useNativeChatOpenSurfaceRequests('session-open-1', 'mention', open))
    act(() => requestNativeChatOpenSurface('session-open-1', 'mention', 'src/main'))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('src/main')
  })

  it('holds a request until a surface mounts to take it, then takes it once', () => {
    requestNativeChatOpenSurface('session-open-2', 'context')
    const open = vi.fn()
    const { unmount } = renderHook(() =>
      useNativeChatOpenSurfaceRequests('session-open-2', 'context', open)
    )
    expect(open).toHaveBeenCalledTimes(1)
    unmount()
    const again = vi.fn()
    renderHook(() => useNativeChatOpenSurfaceRequests('session-open-2', 'context', again))
    expect(again).not.toHaveBeenCalled()
  })

  it('reaches only the chat and surface the request names', () => {
    const other = vi.fn()
    renderHook(() => useNativeChatOpenSurfaceRequests('session-open-3', 'context', other))
    act(() => requestNativeChatOpenSurface('session-open-4', 'context'))
    act(() => requestNativeChatOpenSurface('session-open-3', 'mention', 'x'))
    expect(other).not.toHaveBeenCalled()
  })
})
