import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminalWebViewHandle } from './terminal-webview-contract'
import { useTerminalViewportRefit, type TerminalViewportDims } from './terminal-viewport-refit'

vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 400, height: 900 })
}))

const HANDLE = 'term-1'
const CELL_WIDTH = 10
const CELL_HEIGHT = 20
// 40 rows at full height; with the keyboard up the composer leaves 32.
const FULL_HEIGHT = 800
const LIFTED_HEIGHT = 640

type Refit = ReturnType<typeof useTerminalViewportRefit>

/** The Terminal panel's refit over one open terminal, on a 400 px frame the keyboard can shorten. */
function panelRefit(keyboardResizesFrame: boolean) {
  const terminal: TerminalWebViewHandle = {
    prepareForForegroundRecovery: vi.fn(),
    write: vi.fn(),
    init: vi.fn(),
    resize: vi.fn(),
    reflow: vi.fn(),
    clear: vi.fn(),
    fitDimensions: vi.fn((frame: { width: number; height: number }) => ({
      cols: Math.floor(frame.width / CELL_WIDTH),
      rows: Math.floor(frame.height / CELL_HEIGHT)
    })),
    resetZoom: vi.fn(),
    cancelSelect: vi.fn(),
    doSelectAll: vi.fn(),
    awaitReady: vi.fn(async () => {})
  }
  const viewportRef: { current: TerminalViewportDims | null } = { current: { cols: 40, rows: 40 } }
  const terminalFrameRef: { current: { width: number; height: number } | null } = {
    current: { width: 400, height: FULL_HEIGHT }
  }
  const subscribeToTerminal = vi.fn()
  const unsubscribeTerminal = vi.fn()
  let refit: Refit | undefined
  function Probe() {
    refit = useTerminalViewportRefit({
      activeHandleRef: { current: HANDLE },
      terminalRefs: { current: new Map([[HANDLE, terminal]]) },
      terminalFrameRef,
      viewportRef,
      viewportMeasuredRef: { current: true },
      nativeChatCoveredRef: { current: false },
      clientRef: { current: null },
      deviceTokenRef: { current: null },
      initializedHandlesRef: { current: new Set([HANDLE]) },
      connState: 'connected',
      tabStripVisible: false,
      textScale: 1,
      unsubscribeTerminal,
      subscribeToTerminal
    })
    return null
  }
  act(() => {
    renderer = create(createElement(Probe))
  })
  act(() => refit!.notifyKeyboardResizesFrame(keyboardResizesFrame))
  return {
    viewportRef,
    subscribeToTerminal,
    keyboard: (visible: boolean) => act(() => refit!.notifyKeyboardVisibility(visible)),
    // The session's onLayout: the frame it laid out, then the height notify.
    layOut: (height: number) =>
      act(() => {
        terminalFrameRef.current = { width: 400, height }
        refit!.notifyTerminalFrameHeight(height)
      }),
    wait: async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    }
  }
}

/** A panel whose first layout at full height has settled, so the tests start on the full grid. */
async function panelAtFullHeight(keyboardResizesFrame: boolean) {
  const panel = panelRefit(keyboardResizesFrame)
  panel.layOut(FULL_HEIGHT)
  await panel.wait(150)
  panel.subscribeToTerminal.mockClear()
  return panel
}

let renderer: ReactTestRenderer | undefined
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  act(() => renderer?.unmount())
  renderer = undefined
  vi.useRealTimers()
})

describe('a keyboard that lifts the Terminal panel composer (phone mode)', () => {
  it('resizes the PTY once, to the rows above the composer, when the keyboard shows', async () => {
    const panel = await panelAtFullHeight(true)
    panel.keyboard(true)
    panel.layOut(LIFTED_HEIGHT)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).toHaveBeenCalledTimes(1)
    expect(panel.viewportRef.current).toEqual({ cols: 40, rows: 32 })
  })

  it('restores the full grid with one resize when the keyboard hides', async () => {
    const panel = await panelAtFullHeight(true)
    panel.keyboard(true)
    panel.layOut(LIFTED_HEIGHT)
    await panel.wait(150)
    panel.keyboard(false)
    panel.layOut(FULL_HEIGHT)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).toHaveBeenCalledTimes(2)
    expect(panel.viewportRef.current).toEqual({ cols: 40, rows: 40 })
  })

  it('coalesces the layout churn of one keyboard show into one resize', async () => {
    const panel = await panelAtFullHeight(true)
    panel.keyboard(true)
    panel.layOut(760)
    await panel.wait(50)
    panel.layOut(700)
    await panel.wait(50)
    panel.layOut(LIFTED_HEIGHT)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).toHaveBeenCalledTimes(1)
    expect(panel.viewportRef.current).toEqual({ cols: 40, rows: 32 })
  })

  it('sends no PTY resize when the frame changes but the grid keeps its rows', async () => {
    const panel = await panelAtFullHeight(true)
    panel.keyboard(true)
    panel.layOut(810)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).not.toHaveBeenCalled()
    expect(panel.viewportRef.current).toEqual({ cols: 40, rows: 40 })
  })
})

describe('a keyboard that leaves the host size alone (desktop mode)', () => {
  it('holds a frame change until the keyboard closes, then resizes once', async () => {
    const panel = await panelAtFullHeight(false)
    panel.keyboard(true)
    panel.layOut(LIFTED_HEIGHT)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).not.toHaveBeenCalled()
    panel.keyboard(false)
    await panel.wait(150)
    expect(panel.subscribeToTerminal).toHaveBeenCalledTimes(1)
    expect(panel.viewportRef.current).toEqual({ cols: 40, rows: 32 })
  })
})
