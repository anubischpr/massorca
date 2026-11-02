/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createTestStore } = await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))
vi.mock('@/lib/web-client-location', () => ({ isWebClientLocation: () => false }))

const { useSidePanelPersistence } = await import('./use-side-panel-persistence')

const setUi = vi.fn()

function Probe(): null {
  useSidePanelPersistence()
  return null
}

function mount(): () => void {
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => root.render(<Probe />))
  return () => act(() => root.unmount())
}

beforeEach(() => {
  vi.useFakeTimers()
  setUi.mockReset()
  Object.defineProperty(window, 'api', { configurable: true, value: { ui: { set: setUi } } })
  store.setState({ persistedUIReady: true, sidePanelWidth: 380, sidePanelOpenByWorktree: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSidePanelPersistence', () => {
  it('writes nothing for the hydrated values', () => {
    const unmount = mount()
    act(() => void vi.advanceTimersByTime(1000))
    expect(setUi).not.toHaveBeenCalled()
    unmount()
  })

  it('saves a resized width once, with only the two side panel fields', () => {
    const unmount = mount()
    act(() => store.getState().setSidePanelWidth(450))
    act(() => store.getState().setSidePanelWidth(460))
    act(() => void vi.advanceTimersByTime(300))
    expect(setUi).toHaveBeenCalledTimes(1)
    expect(setUi).toHaveBeenCalledWith({ sidePanelWidth: 460, sidePanelOpenByWorktree: {} })
    unmount()
  })

  it('saves an explicit open choice for a workspace', () => {
    const unmount = mount()
    act(() => store.getState().setSidePanelOpen('wt-1', true))
    act(() => void vi.advanceTimersByTime(300))
    expect(setUi).toHaveBeenCalledWith(
      expect.objectContaining({ sidePanelOpenByWorktree: { 'wt-1': true } })
    )
    unmount()
  })
})
