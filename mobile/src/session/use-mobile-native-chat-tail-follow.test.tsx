import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useMobileNativeChatTailFollow,
  type MobileNativeChatTailFollow
} from './use-mobile-native-chat-tail-follow'

type Follow = MobileNativeChatTailFollow<string>

let latest: Follow | null = null

function Harness(props: { hasItems: boolean }) {
  latest = useMobileNativeChatTailFollow<string>({ hasItems: props.hasItems })
  return null
}

const frames: FrameRequestCallback[] = []

function flushFrames(): void {
  act(() => {
    while (frames.length > 0) {
      frames.shift()?.(0)
    }
  })
}

function layout(height: number) {
  return { nativeEvent: { layout: { height } } }
}

function scrollEvent(offset: number, content: number, viewport: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 400, height: content },
      layoutMeasurement: { width: 400, height: viewport }
    }
  }
}

describe('useMobileNativeChatTailFollow', () => {
  let renderer: ReactTestRenderer | null = null
  let scrollToEnd: ReturnType<typeof vi.fn>
  let scrollToOffset: ReturnType<typeof vi.fn>

  beforeEach(() => {
    frames.length = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.splice(id - 1, 1, () => {})
    })
    act(() => {
      renderer = create(createElement(Harness, { hasItems: true }))
    })
    scrollToEnd = vi.fn()
    scrollToOffset = vi.fn()
    Object.assign(latest!.listRef, { current: { scrollToEnd, scrollToOffset } })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    latest = null
    vi.unstubAllGlobals()
  })

  it('pins once to the list end for a real resize, never to the raw content height', () => {
    latest!.pinToTail(layout(600))
    latest!.pinToTailAfterContentResize(400, 2000)
    flushFrames()

    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
    expect(scrollToOffset).not.toHaveBeenCalled()
  })

  it('does not re-pin while the measured geometry stays the same, so an idle chat holds still', () => {
    latest!.pinToTail(layout(600))
    latest!.pinToTailAfterContentResize(400, 2000)
    flushFrames()
    scrollToEnd.mockClear()

    for (let tick = 0; tick < 5; tick += 1) {
      latest!.pinToTail(layout(600))
      latest!.pinToTailAfterContentResize(400, 2000.4)
      flushFrames()
    }

    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  it('follows streamed growth while the user is at the tail', () => {
    latest!.pinToTailAfterContentResize(400, 2000)
    flushFrames()
    latest!.pinToTailAfterContentResize(400, 2100)
    flushFrames()
    latest!.pinToTailAfterContentResize(400, 2240)
    flushFrames()

    expect(scrollToEnd).toHaveBeenCalledTimes(3)
  })

  it('leaves the view where the user scrolled while content keeps growing', () => {
    act(() => latest!.beginUserScroll())
    act(() => latest!.endMomentum(scrollEvent(200, 2000, 600)))
    scrollToEnd.mockClear()

    latest!.pinToTailAfterContentResize(400, 2400)
    latest!.pinToTail(layout(560))
    flushFrames()

    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(scrollToOffset).not.toHaveBeenCalled()
    expect(latest!.showJumpToTail).toBe(true)
  })

  it('drops a pin queued before the user grabbed the list', () => {
    latest!.pinToTailAfterContentResize(400, 2000)
    act(() => latest!.beginUserScroll())
    flushFrames()

    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  it('jumps to the tail immediately on an explicit jump and resumes following', () => {
    act(() => latest!.beginUserScroll())
    act(() => latest!.endMomentum(scrollEvent(200, 2000, 600)))
    scrollToEnd.mockClear()

    act(() => latest!.jumpToTail())
    expect(scrollToEnd).toHaveBeenCalledTimes(1)

    latest!.pinToTailAfterContentResize(400, 2300)
    flushFrames()
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })
})
